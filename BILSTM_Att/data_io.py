"""Dataset loading helpers for BiLSTM training and evaluation.

The expected sample format is a numeric row:

    [label, teamAId, teamBId, A1pos, A1heroId, A1winRate, ...]

JSON files may contain either a top-level list of rows or {"data": rows}.
JSONL files should contain one row per line. CSV files are also supported.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable

import numpy as np


def _coerce_row(row: object) -> list[float]:
    if isinstance(row, dict):
        row = row.get("features") or row.get("row") or row.get("values")
    if not isinstance(row, (list, tuple)):
        raise ValueError(f"Invalid training row: {row!r}")
    return [float(value) for value in row]


def _read_json(path: Path) -> Iterable[object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload.get("data") or payload.get("rows") or payload.get("samples") or []
    if not isinstance(payload, list):
        raise ValueError(f"{path} must contain a list of rows")
    return payload


def _read_jsonl(path: Path) -> Iterable[object]:
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line:
                yield json.loads(line)


def _read_csv(path: Path) -> Iterable[object]:
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.reader(file)
        for row in reader:
            if not row:
                continue
            try:
                yield [float(value) for value in row]
            except ValueError:
                continue


def load_vector_dataset(path: str | Path) -> np.ndarray:
    data_path = Path(path)
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {data_path}")

    suffix = data_path.suffix.lower()
    if suffix == ".json":
        rows = _read_json(data_path)
    elif suffix in {".jsonl", ".ndjson"}:
        rows = _read_jsonl(data_path)
    elif suffix == ".csv":
        rows = _read_csv(data_path)
    else:
        raise ValueError("Dataset must be .json, .jsonl, .ndjson, or .csv")

    data = np.array([_coerce_row(row) for row in rows], dtype=np.float32)
    if data.ndim != 2 or data.shape[1] < 2:
        raise ValueError("Dataset must be a 2D numeric matrix with label + features")
    return data
