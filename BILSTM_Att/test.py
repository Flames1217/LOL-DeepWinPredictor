"""Evaluate a BiLSTM model from a local JSON/JSONL/CSV dataset."""

from __future__ import annotations

import os
import sys

import numpy as np
import torch

from BILSTM_Att.BILSTM_Att import BiLSTMModelWithAttention
from BILSTM_Att.data_io import load_vector_dataset
from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()


def evaluate(dataset_path: str, model_path: str = "BILSTM_Att.pt") -> dict[str, float]:
    data = load_vector_dataset(dataset_path)
    x = torch.tensor(data[:, 1:], dtype=torch.float32).unsqueeze(1)
    y_true = data[:, 0].astype(int)

    model = BiLSTMModelWithAttention(
        input_size=data.shape[1] - 1,
        hidden_size=1024,
        num_layers=2,
        output_size=1,
    )
    model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
    model.eval()

    with torch.no_grad():
        scores = model(x).cpu().numpy().reshape(-1)
    y_pred = (scores > 0.5).astype(int)

    accuracy = float((y_pred == y_true).mean())
    true_positive = int(((y_pred == 1) & (y_true == 1)).sum())
    false_positive = int(((y_pred == 1) & (y_true == 0)).sum())
    false_negative = int(((y_pred == 0) & (y_true == 1)).sum())
    precision = true_positive / max(true_positive + false_positive, 1)
    recall = true_positive / max(true_positive + false_negative, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-9)

    metrics = {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}
    rich_logger.info(f"Evaluation metrics: {metrics}")
    return metrics


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else os.getenv("TEST_DATA_PATH")
    if not path:
        raise SystemExit("Usage: python -m BILSTM_Att.test <dataset.json|jsonl|csv>")
    evaluate(path, os.getenv("TEST_MODEL_PATH", "BILSTM_Att.pt"))
