import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import requests


def _runtime_cache_dir(default_model_path: str) -> Path:
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return Path("/tmp/lol-deepwin-models")
    return Path(default_model_path).parent


def _normalize_model_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme == "s3":
        return f"https://{parsed.netloc}.s3.amazonaws.com{parsed.path}"
    if parsed.scheme == "webdav":
        return urlunparse(("https", parsed.netloc, parsed.path, "", parsed.query, ""))
    return raw_url


def _cache_filename(model_url: str, default_model_path: str) -> str:
    parsed_name = Path(urlparse(model_url).path).name
    return parsed_name or Path(default_model_path).name


def _valid_model_file(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def _download_to_path(model_url: str, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination.with_suffix(destination.suffix + ".tmp")
    headers = {"User-Agent": "LOL-DeepWinPredictor/2.5"}

    with requests.get(model_url, headers=headers, stream=True, timeout=(10, 120)) as response:
        response.raise_for_status()
        with open(temp_path, "wb") as file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    file.write(chunk)

    os.replace(temp_path, destination)
    return str(destination)


def resolve_model_path(default_model_path: str, logger=None) -> str:
    local_path = Path(default_model_path)
    if _valid_model_file(local_path):
        return str(local_path)

    raw_model_url = os.getenv("MODEL_URL", "").strip()
    if not raw_model_url:
        if logger:
            logger.warning(f"model file not found and MODEL_URL is not configured: {local_path}")
        return str(local_path)

    model_url = _normalize_model_url(raw_model_url)
    cached_path = _runtime_cache_dir(default_model_path) / _cache_filename(model_url, default_model_path)
    if _valid_model_file(cached_path):
        return str(cached_path)

    if logger:
        logger.info(f"downloading model from MODEL_URL to {cached_path}")
    return _download_to_path(model_url, cached_path)
