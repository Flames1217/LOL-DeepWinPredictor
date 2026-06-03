import json
import os
from typing import Any, Dict, List

import requests


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_CONFIG_PATH = os.path.join(BASE_DIR, "data", "json", "ai_provider_config.json")
PUBLIC_CONFIG_KEYS = {"provider", "model", "baseUrl", "enabled"}
AI_OUTPUT_SCHEMA = {
    "summary": "one sentence match read",
    "confidence": "low | medium | high",
    "keyFactors": ["factor"],
    "risks": ["risk"],
    "dataGaps": ["missing data"],
    "recommendedView": "short suggestion",
}


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _load_file_config() -> Dict[str, Any]:
    try:
        with open(AI_CONFIG_PATH, "r", encoding="utf-8") as file:
            payload = json.load(file)
        return payload if isinstance(payload, dict) else {}
    except FileNotFoundError:
        return {}


def _write_file_config(payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(AI_CONFIG_PATH), exist_ok=True)
    with open(AI_CONFIG_PATH, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _runtime_config() -> Dict[str, Any]:
    file_config = _load_file_config()
    provider = _env("AI_PROVIDER") or str(file_config.get("provider") or "disabled")
    return {
        "provider": provider,
        "model": _env("AI_MODEL") or str(file_config.get("model") or ""),
        "baseUrl": normalize_ai_base_url(provider, _env("AI_BASE_URL") or str(file_config.get("baseUrl") or "")),
        "apiKey": _env("AI_API_KEY") or str(file_config.get("apiKey") or ""),
        "enabled": bool(file_config.get("enabled", True)),
    }


def _mask_key(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}{'*' * max(4, len(value) - 7)}{value[-4:]}"


def get_ai_prediction_config() -> Dict[str, Any]:
    runtime = _runtime_config()
    provider = str(runtime.get("provider") or "disabled").lower()
    model = str(runtime.get("model") or "")
    base_url = str(runtime.get("baseUrl") or "")
    api_key = str(runtime.get("apiKey") or "")
    has_key = bool(api_key)
    enabled = bool(runtime.get("enabled", True)) and provider not in {"", "disabled", "none", "off"} and (has_key or provider == "ollama")

    return {
        "enabled": enabled,
        "provider": provider,
        "model": model,
        "baseUrl": base_url,
        "baseUrlConfigured": bool(base_url),
        "hasApiKey": has_key,
        "maskedApiKey": _mask_key(api_key),
        "configPath": AI_CONFIG_PATH,
        "supportsRealtime": enabled,
        "realtimeModes": ["draft", "manual_live_state", "external_live_feed"],
    }


def normalize_ai_base_url(provider: str, base_url: str) -> str:
    provider = str(provider or "").strip().lower()
    value = str(base_url or "").strip()
    if not value:
        if provider == "openai":
            return "https://api.openai.com/v1"
        if provider == "ollama":
            return "http://localhost:11434/v1"
        return ""

    if not value.startswith(("http://", "https://")):
        scheme = "http" if provider == "ollama" or value.startswith(("localhost", "127.0.0.1")) else "https"
        value = f"{scheme}://{value}"

    value = value.rstrip("/")
    chat_suffix = "/chat/completions"
    if value.endswith(chat_suffix):
        value = value[: -len(chat_suffix)]

    if not value.endswith("/v1") and "/v1/" not in value:
        value = f"{value}/v1"
    return value.rstrip("/")


def save_ai_prediction_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    previous = _load_file_config()
    provider = str(payload.get("provider") or previous.get("provider") or "disabled").strip().lower()
    next_config = {
        "enabled": bool(payload.get("enabled", True)),
        "provider": provider,
        "model": str(payload.get("model") or previous.get("model") or "").strip(),
        "baseUrl": normalize_ai_base_url(provider, str(payload.get("baseUrl") or previous.get("baseUrl") or "")),
        "apiKey": str(previous.get("apiKey") or "").strip(),
    }
    if "apiKey" in payload and str(payload.get("apiKey") or "").strip():
        next_config["apiKey"] = str(payload.get("apiKey") or "").strip()
    if payload.get("clearApiKey"):
        next_config["apiKey"] = ""
    _write_file_config(next_config)
    return get_ai_prediction_config()


def build_prediction_messages(context: Dict[str, Any]) -> List[Dict[str, str]]:
    system = (
        "You are a League of Legends esports prediction analyst. "
        "Reply in Simplified Chinese. Use the numeric win rates supplied by the local model as fixed facts; "
        "do not replace them with your own probabilities. Do not fabricate missing live data, rosters, runes, "
        "or match events. If data is incomplete, say what is missing. Return JSON only."
    )
    user = json.dumps(
        {
            "task": "Explain the prediction without changing the supplied probability.",
            "schema": AI_OUTPUT_SCHEMA,
            "context": context,
        },
        ensure_ascii=False,
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def local_prediction_analysis(context: Dict[str, Any]) -> Dict[str, Any]:
    result = context.get("result") or {}
    a_win = float(result.get("A_win") or 50)
    b_win = float(result.get("B_win") or 50)
    gap = abs(a_win - b_win)
    confidence = "high" if gap >= 18 else "medium" if gap >= 8 else "low"
    leader = "蓝方" if a_win >= b_win else "红方"
    summary = f"{leader}当前略占优，校准后胜率为 {max(a_win, b_win):.1f}%。"

    return {
        "available": False,
        "summary": summary,
        "confidence": confidence,
        "keyFactors": [
            "本地 BiLSTM 输出已与队伍和阵容先验做混合校准",
            "英雄分路胜率和已选队伍强度会影响最终概率",
        ],
        "risks": ["当前未接入实时经济、视野、资源和团战事件"],
        "dataGaps": ["如需实时预测，需要外部实时比赛事件流或人工录入局内状态"],
        "recommendedView": "把该结果视为赛前 BP 和队伍强度预测，不等同于实时局势胜率。",
    }


def _provider_endpoint(provider: str, base_url: str) -> str:
    base_url = normalize_ai_base_url(provider, base_url)
    if not base_url:
        raise RuntimeError("AI_BASE_URL is required for this provider")
    return base_url.rstrip("/") + "/chat/completions"


def _provider_headers(api_key_override: str = "") -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    api_key = str(api_key_override or _runtime_config().get("apiKey") or "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _parse_json_object(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def call_ai_prediction_analysis(context: Dict[str, Any]) -> Dict[str, Any]:
    config = get_ai_prediction_config()
    if not config["enabled"]:
        return local_prediction_analysis(context)

    provider = config["provider"]
    model = config["model"]
    if not model:
        fallback = local_prediction_analysis(context)
        fallback["error"] = "AI_MODEL is not configured"
        return fallback

    payload = {
        "model": model,
        "messages": build_prediction_messages(context),
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    endpoint = _provider_endpoint(provider, str(_runtime_config().get("baseUrl") or ""))

    try:
        response = requests.post(endpoint, headers=_provider_headers(), json=payload, timeout=30)
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        parsed = _parse_json_object(content)
        parsed["available"] = True
        parsed["provider"] = provider
        parsed["model"] = model
        return parsed
    except Exception as exc:
        fallback = local_prediction_analysis(context)
        fallback["error"] = str(exc)
        return fallback


def test_ai_provider_connection(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = payload or {}
    config = get_ai_prediction_config()
    provider = str(payload.get("provider") or config.get("provider") or "disabled").strip().lower()
    model = str(payload.get("model") or config.get("model") or "").strip()
    base_url = normalize_ai_base_url(provider, str(payload.get("baseUrl") or config.get("baseUrl") or ""))
    api_key = str(payload.get("apiKey") or _runtime_config().get("apiKey") or "")
    enabled = bool(payload.get("enabled", config.get("enabled", True)))
    endpoint = ""

    if not enabled or provider in {"", "disabled", "none", "off"}:
        return {
            "available": False,
            "provider": provider,
            "model": model,
            "baseUrl": base_url,
            "summary": "连接未测试：AI 分析未启用。",
        }
    if not model:
        return {
            "available": False,
            "provider": provider,
            "model": model,
            "baseUrl": base_url,
            "summary": "连接失败：请先填写模型名。",
            "error": "AI_MODEL is not configured",
        }

    try:
        endpoint = _provider_endpoint(provider, base_url)
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "Return compact JSON only."},
                {"role": "user", "content": "{\"ok\": true}"},
            ],
            "temperature": 0,
            "max_tokens": 32,
        }
        response = requests.post(endpoint, headers=_provider_headers(api_key), json=payload, timeout=20)
        response.raise_for_status()
        body = response.json()
        content = str(((body.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        return {
            "available": True,
            "provider": provider,
            "model": model,
            "baseUrl": base_url,
            "endpoint": endpoint,
            "summary": "连接成功：提供商已返回有效响应。",
            "rawPreview": content[:160],
        }
    except Exception as exc:
        return {
            "available": False,
            "provider": provider,
            "model": model,
            "baseUrl": base_url,
            "endpoint": endpoint,
            "summary": "连接失败：请检查 Base URL、模型名、API Key 或接口路径。",
            "error": str(exc),
        }
