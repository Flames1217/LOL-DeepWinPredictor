import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse

import requests


MODEL_URL_ENV_KEYS = ('MODEL_URL', 'MODEL_REMOTE_URL', 'S3_MODEL_URL', 'WEBDAV_MODEL_URL')


def _env_first(keys):
    for key in keys:
        value = os.getenv(key)
        if value:
            return value
    return ''


def _runtime_cache_dir(default_model_path):
    configured = os.getenv('MODEL_CACHE_DIR')
    if configured:
        return Path(configured)
    if os.getenv('VERCEL') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
        return Path('/tmp/lol-deepwin-models')
    return Path(default_model_path).parent


def _download_headers():
    raw_headers = os.getenv('MODEL_HTTP_HEADERS') or os.getenv('MODEL_HEADERS')
    if not raw_headers:
        return {}
    try:
        headers = json.loads(raw_headers)
    except json.JSONDecodeError:
        return {}
    return {str(key): str(value) for key, value in headers.items()}


def _download_auth(model_url):
    username = (
        os.getenv('MODEL_BASIC_AUTH_USER')
        or os.getenv('MODEL_USERNAME')
        or os.getenv('WEBDAV_USERNAME')
    )
    password = (
        os.getenv('MODEL_BASIC_AUTH_PASSWORD')
        or os.getenv('MODEL_PASSWORD')
        or os.getenv('WEBDAV_PASSWORD')
    )
    if username and password:
        return username, password

    parsed = urlparse(model_url)
    if parsed.username and parsed.password:
        return parsed.username, parsed.password
    return None


def _expected_sha256():
    return os.getenv('MODEL_SHA256') or os.getenv('MODEL_CHECKSUM_SHA256') or ''


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _valid_cached_model(path):
    if not path.exists() or path.stat().st_size <= 0:
        return False
    expected = _expected_sha256()
    return not expected or _sha256(path).lower() == expected.lower()


def _download_to_path(model_url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination.with_suffix(destination.suffix + '.tmp')
    auth = _download_auth(model_url)
    headers = {'User-Agent': 'LOL-DeepWinPredictor/2.4'}
    headers.update(_download_headers())

    with requests.get(model_url, headers=headers, auth=auth, stream=True, timeout=(10, 120)) as response:
        response.raise_for_status()
        with open(temp_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    file.write(chunk)

    expected = _expected_sha256()
    if expected and _sha256(temp_path).lower() != expected.lower():
        temp_path.unlink(missing_ok=True)
        raise ValueError('downloaded model sha256 does not match MODEL_SHA256')

    os.replace(temp_path, destination)
    return str(destination)


def resolve_model_path(default_model_path, logger=None):
    local_override = os.getenv('MODEL_PATH') or os.getenv('MODEL_LOCAL_PATH')
    local_path = Path(local_override or default_model_path)
    if _valid_cached_model(local_path):
        return str(local_path)

    model_url = _env_first(MODEL_URL_ENV_KEYS)
    if not model_url:
        if logger:
            logger.warning(f'model file not found and no remote model URL configured: {local_path}')
        return str(local_path)

    cache_dir = _runtime_cache_dir(default_model_path)
    filename = os.getenv('MODEL_FILENAME') or Path(urlparse(model_url).path).name or Path(default_model_path).name
    cached_path = cache_dir / filename
    if _valid_cached_model(cached_path):
        return str(cached_path)

    if logger:
        logger.info(f'downloading model from remote storage to {cached_path}')
    return _download_to_path(model_url, cached_path)
