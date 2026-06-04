# -*- coding: utf-8 -*-
"""Shared environment and path settings for live source integrations."""

from __future__ import annotations

import os
import re
import warnings

import orjson
import urllib3
from dotenv import load_dotenv

from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", category=UserWarning)

ORJSON_OPTS = orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS | orjson.OPT_APPEND_NEWLINE

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_env_files() -> None:
    env_files = [
        file_name
        for file_name in os.listdir(project_root)
        if re.match(r"^\.env($|\..*)", file_name)
    ]

    for file_name in (".env.local", ".env"):
        if file_name not in env_files:
            continue
        env_path = os.path.join(project_root, file_name)
        try:
            if load_dotenv(env_path, override=True):
                rich_logger.info(f"[env] loaded {env_path}")
                return
            rich_logger.warning(f"[env] skipped empty env file: {env_path}")
        except Exception as exc:
            rich_logger.error(f"[env] failed to load {env_path}: {exc}")

    rich_logger.warning("[env] no .env file loaded; using process environment only")


_load_env_files()

AUTHORIZATION = "7935be4c41d8760a28c05581a7b1f570"
PROXIES = os.getenv("PROXIES")
MODEL_PATH = os.path.join(project_root, "static", "saved_model", "BILSTM_Att.pt")
