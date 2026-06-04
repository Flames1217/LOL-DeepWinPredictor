# -*- coding: utf-8 -*-
"""Fetch and cache champion ranking data from OP.GG.

The frontend reads champion stats through Flask. This module keeps that API fast
by scraping OP.GG into local JSON files, then serving cached payloads.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime
from functools import lru_cache
from typing import Any

import requests

from Data_CrawlProcess import env
from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()

OPGG_CHAMPIONS_URL = "https://op.gg/zh-cn/lol/champions"
OPGG_CHAMPION_API_URL = "https://lol-api-champion.op.gg/api/{region}/champions/ranked"
OPGG_CACHE_ROOT = os.path.join(env.project_root, "data", "json", "champion_stats", "opgg")
OPGG_DETAIL_CACHE_ROOT = os.path.join(env.project_root, "data", "json", "champion_stats", "opgg_details")
OPGG_REGION_ICON_ROOT = os.path.join(env.project_root, "data", "json", "champion_stats", "opgg_region_icons")
OPGG_ROLE_ICON_ROOT = os.path.join(env.project_root, "data", "json", "champion_stats", "opgg_role_icons")
STATUS_PATH = os.path.join(env.project_root, "data", "json", "champion_stats", "sync_status.json")
DEFAULT_INTERVAL_SECONDS = int(os.getenv("CHAMPION_STATS_SYNC_INTERVAL", str(60 * 60 * 6)))
DEFAULT_PATCH = os.getenv("CHAMPION_STATS_DEFAULT_PATCH", "")
DETAIL_CACHE_TTL_SECONDS = int(os.getenv("CHAMPION_DETAIL_CACHE_TTL", str(60 * 60 * 12)))

OPGG_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
}

TENCENT_HERO_DETAIL_URL = "https://game.gtimg.cn/images/lol/act/img/js/hero/{hero_id}.js"
TENCENT_HERO_LIST_URL = "https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js"
TENCENT_GUIDE_DETAIL_URL = "https://lol.qq.com/act/lbp/common/guides/champDetail/champDetail_{hero_id}.js"
TENCENT_RUNE_LIST_URL = "https://game.gtimg.cn/images/lol/act/img/js/runeList/rune_list.js"
TENCENT_ITEM_LIST_URL = "https://game.gtimg.cn/images/lol/act/img/js/items/items.js"
TENCENT_SUMMONER_LIST_URL = "https://game.gtimg.cn/images/lol/act/img/js/summonerskillList/summonerskill_list.js"

_status_lock = threading.Lock()
_scheduler_started = False
_last_status: dict[str, Any] = {
    "running": False,
    "lastSuccessAt": None,
    "lastErrorAt": None,
    "lastError": None,
    "lastPayload": None,
}

CHINA_FLAG_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" fill-rule="evenodd"><path fill="#DE2910" d="M0 3h24v18H0z"/><path fill="#FFDE00" d="m5.1 5.4.67 2.06h2.17L6.18 8.74l.67 2.06L5.1 9.53 3.35 10.8l.67-2.06-1.76-1.28h2.17L5.1 5.4Zm5.45.75.36.73.8.12-.58.57.14.8-.72-.38-.72.38.14-.8-.58-.57.8-.12.36-.73Zm2.04 2.16.25.78h.82l-.66.48.25.78-.66-.48-.67.48.26-.78-.67-.48h.82l.26-.78Zm-.05 3.17.25.78h.82l-.66.48.25.78-.66-.48-.67.48.26-.78-.67-.48h.82l.26-.78Zm-1.99 2.31.36.73.8.12-.58.57.14.8-.72-.38-.72.38.14-.8-.58-.57.8-.12.36-.73Z"/></g></svg>"""

# OP.GG renders role icons inline in the champion table. These SVG paths are
# copied from that source markup and kept as cache fallbacks.
OPGG_ROLE_SVGS = {
    "ADC": """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#98A0A7"><g fill="currentColor" fill-rule="nonzero"><path d="m19 3-4 4H7v8l-4 4V3z" opacity="0.2"></path><path d="m5 21 4-4h8V9l4-4v16z"></path><path d="M10 10h4v4h-4z" opacity="0.2"></path></g></svg>""",
    "SUP": """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#98A0A7"><path fill="currentColor" fill-rule="nonzero" d="M12.833 10.833 14.5 17.53v.804L12.833 20h-1.666L9.5 18.333v-.804l1.667-6.696zM7 7.5 9.5 10l-1.667 4.167-2.5-2.5L6.167 10h-2.5L2 7.5zm15 0L20.333 10h-2.5l.834 1.667-2.5 2.5L14.5 10 17 7.5zM13.743 5l.757.833v.834l-1.667 2.5h-1.666L9.5 6.667v-.834L10.257 5z"></path></svg>""",
    "JUN": """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#98A0A7"><path fill="currentColor" fill-rule="nonzero" d="M5.14 2c1.58 1.21 5.58 5.023 6.976 9.953s0 10.047 0 10.047c-2.749-3.164-5.893-5.2-6.18-5.382l-.02-.013C5.45 13.814 3 8.79 3 8.79c3.536.867 4.93 4.279 4.93 4.279C7.558 8.698 5.14 2 5.14 2m14.976 5.907s-1.243 2.471-1.814 4.604c-.235.878-.285 2.2-.29 3.058v.282c.003.347.01.568.01.568s-1.738 2.397-3.38 3.678a27.5 27.5 0 0 0-.208-5.334c.928-2.023 2.487-4.94 5.682-6.856"></path></svg>""",
    "MID": """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#98A0A7"><g fill="currentColor" fill-rule="nonzero"><path d="m15 3-4 4H7v4l-4 4V3zM9 21l4-4h4v-4l4-4v12z" opacity="0.2"></path><path d="M18 3h3v3L6 21H3v-3z"></path></g></svg>""",
    "TOP": """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#98A0A7"><g fill="currentColor" fill-rule="nonzero"><path d="m19 3-4 4H7v8l-4 4V3z"></path><path d="m5 21 4-4h8V9l4-4v16z" opacity="0.2"></path><path d="M10 10h4v4h-4z" opacity="0.2"></path></g></svg>""",
}

OPGG_ROLE_PATHS = {
    "TOP": "top",
    "JUN": "jungle",
    "JUNGLE": "jungle",
    "MID": "mid",
    "MIDDLE": "mid",
    "ADC": "adc",
    "BOT": "adc",
    "BOTTOM": "adc",
    "SUP": "support",
    "SUPPORT": "support",
}
TENCENT_LANE_BY_POSITION = {
    "top": "top",
    "jungle": "jungle",
    "mid": "mid",
    "middle": "mid",
    "adc": "bottom",
    "bottom": "bottom",
    "support": "support",
}


def _safe_key(value: str | None, fallback: str) -> str:
    raw = (value or fallback).strip().lower()
    return re.sub(r"[^a-z0-9_.+-]+", "_", raw) or fallback


def _ensure_opgg_html_response(response: requests.Response, source: str) -> None:
    waf_action = response.headers.get("x-amzn-waf-action", "")
    if response.status_code == 202 or waf_action.lower() == "challenge" or "AwsWafIntegration" in response.text:
        raise ValueError(f"OP.GG {source} returned WAF challenge")
    response.raise_for_status()


def _detail_has_content(payload: dict[str, Any] | None) -> bool:
    if not isinstance(payload, dict):
        return False
    items = payload.get("items") if isinstance(payload.get("items"), dict) else {}
    return any(
        [
            payload.get("counters"),
            payload.get("runePages"),
            payload.get("singleRuneBuilds"),
            payload.get("summonerSpells"),
            items.get("starterItems"),
            items.get("boots"),
            items.get("coreItems"),
            payload.get("skills"),
            payload.get("passive"),
        ]
    )


def _detail_has_build_content(payload: dict[str, Any] | None) -> bool:
    if not isinstance(payload, dict):
        return False
    items = payload.get("items") if isinstance(payload.get("items"), dict) else {}
    return any(
        [
            payload.get("runePages"),
            payload.get("singleRuneBuilds"),
            payload.get("summonerSpells"),
            items.get("starterItems"),
            items.get("boots"),
            items.get("coreItems"),
        ]
    )


def _detail_has_rich_build_content(payload: dict[str, Any] | None) -> bool:
    if not _detail_has_build_content(payload):
        return False
    items = payload.get("items") if isinstance(payload.get("items"), dict) else {}
    return bool(payload.get("laneStats") or payload.get("skillBuilds") or items.get("itemStats"))


def _cache_path(
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "SOLORANKED",
) -> str:
    patch_key = _safe_key(patch or "latest", "latest")
    game_key = _safe_key(game_type or "SOLORANKED", "SOLORANKED")
    return os.path.join(
        OPGG_CACHE_ROOT,
        _safe_key(region, "global"),
        _safe_key(tier, "all"),
        game_key,
        f"{patch_key}.json",
    )


def _load_stats_cache(
    region: str,
    tier: str,
    patch: str | None,
    game_type: str,
) -> tuple[dict[str, Any] | None, str | None]:
    path = _cache_path(region, tier, patch, game_type)
    cached = _load_json(path)
    if cached:
        return cached, path
    return None, None


def _prepare_cached_stats(
    cached: dict[str, Any],
    *,
    requested_region: str | None = None,
) -> dict[str, Any]:
    _add_rank_delta(cached)
    _add_derived_metrics(cached)
    if requested_region:
        cached["requestedRegion"] = requested_region
    cached.pop("fallbackRegion", None)
    cached["cacheFallback"] = False
    return cached


def _detail_cache_path(
    champion: str,
    position: str = "adc",
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "ranked",
    target_champion: str | None = None,
) -> str:
    filename = f"{_safe_key(champion, 'champion')}.json"
    if target_champion:
        filename = f"{_safe_key(champion, 'champion')}__vs__{_safe_key(target_champion, 'target')}.json"
    return os.path.join(
        OPGG_DETAIL_CACHE_ROOT,
        _safe_key(region, "global"),
        _safe_key(tier, "all"),
        _safe_key(game_type or "ranked", "ranked"),
        _safe_key(patch or "latest", "latest"),
        _safe_key(position, "adc"),
        filename,
    )


def _region_icon_path(region: str) -> str:
    return os.path.join(OPGG_REGION_ICON_ROOT, f"{_safe_key(region, 'global')}.svg")


def _role_icon_path(role: str) -> str:
    return os.path.join(OPGG_ROLE_ICON_ROOT, f"{_safe_key(role, 'top')}.svg")


def _load_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as file:
            payload = json.load(file)
        return payload if isinstance(payload, dict) else None
    except FileNotFoundError:
        return None
    except Exception as exc:
        rich_logger.error(f"[ChampionStatsSync] read cache failed {path}: {exc}")
        return None


def _write_json(path: str, payload: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    os.replace(temp_path, path)


def _is_fresh(path: str, ttl_seconds: int) -> bool:
    try:
        return time.time() - os.path.getmtime(path) < ttl_seconds
    except OSError:
        return False


def _extract_flight_text(html: str) -> str:
    parts: list[str] = []
    scripts = re.findall(r"<script[^>]*>([\s\S]*?)</script>", html, re.IGNORECASE)
    for script in scripts:
        match = re.match(r"self\.__next_f\.push\((\[.*\])\)$", script.strip(), re.DOTALL)
        if not match:
            continue
        try:
            frame = json.loads(match.group(1))
        except Exception:
            continue
        if len(frame) > 1 and isinstance(frame[1], str):
            parts.append(frame[1])
    return "\n".join(parts)


def _extract_balanced_json(text: str, start: int) -> Any | None:
    if start < 0 or start >= len(text) or text[start] not in "[{":
        return None

    opening = text[start]
    closing = "]" if opening == "[" else "}"
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            continue
        if char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : index + 1])
                except Exception:
                    return None
    return None


def _extract_json_after(text: str, marker: str) -> Any | None:
    marker_index = text.find(marker)
    if marker_index < 0:
        return None
    start = text.find("{", marker_index)
    return _extract_balanced_json(text, start)


def _normalize_count(value: str | int | float | None) -> int | None:
    if value is None:
        return None
    try:
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def _normalize_float(value: str | int | float | None) -> float | None:
    if value is None:
        return None
    try:
        return round(float(str(value).replace(",", "").strip()), 4)
    except (TypeError, ValueError):
        return None


def _parse_js_object_payload(text: str) -> dict[str, Any]:
    start = text.find("{")
    if start < 0:
        return {}

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start:index + 1])
    return {}


def _qq_rate(value: Any) -> float | None:
    number = _normalize_float(value)
    if number is None:
        return None
    return round(number / 100, 2)


def _https_url(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("//"):
        return f"https:{value}"
    return value.replace("http://", "https://")


@lru_cache(maxsize=1)
def _tencent_hero_candidates() -> list[dict[str, Any]]:
    try:
        response = requests.get(TENCENT_HERO_LIST_URL, timeout=15)
        response.raise_for_status()
        payload = response.json()
        heroes = payload.get("hero", []) if isinstance(payload, dict) else []
        return [hero for hero in heroes if isinstance(hero, dict)]
    except Exception as exc:
        rich_logger.warning(f"[ChampionStatsSync] 101 hero list fetch failed: {exc}")
        return []


def _champion_id_by_key() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for hero in _tencent_hero_candidates():
        hero_id = hero.get("heroId")
        for key in (hero.get("alias"), hero.get("name"), hero.get("title")):
            if key and hero_id:
                mapping[str(key).lower()] = str(hero_id)
    return mapping


def _champion_meta_by_key() -> dict[str, dict[str, Any]]:
    mapping: dict[str, dict[str, Any]] = {}
    for hero in _tencent_hero_candidates():
        alias = str(hero.get("alias") or "").lower()
        if not alias:
            continue
        mapping[alias] = {
            "heroId": hero.get("heroId"),
            "name": hero.get("name") or hero.get("title") or hero.get("alias"),
            "alias": hero.get("alias"),
            "image_url": hero.get("heroLogo") or f"https://game.gtimg.cn/images/lol/act/img/champion/{hero.get('alias')}.png",
        }
    return mapping


@lru_cache(maxsize=1)
def _tencent_rune_lookup() -> dict[str, dict[str, Any]]:
    try:
        response = requests.get(TENCENT_RUNE_LIST_URL, timeout=15)
        response.raise_for_status()
        payload = response.json()
        runes = payload.get("rune", {}) if isinstance(payload, dict) else {}
    except Exception as exc:
        rich_logger.warning(f"[ChampionStatsSync] 101 rune list fetch failed: {exc}")
        return {}

    return {
        str(rune_id): {
            "id": int(rune_id) if str(rune_id).isdigit() else rune_id,
            "name": rune.get("name") or str(rune_id),
            "image_url": _https_url(rune.get("icon")),
            "styleName": rune.get("styleName"),
        }
        for rune_id, rune in runes.items()
        if isinstance(rune, dict)
    }


@lru_cache(maxsize=1)
def _tencent_item_lookup() -> dict[str, dict[str, Any]]:
    try:
        response = requests.get(TENCENT_ITEM_LIST_URL, timeout=15)
        response.raise_for_status()
        payload = response.json()
        items = payload.get("items", []) if isinstance(payload, dict) else []
    except Exception as exc:
        rich_logger.warning(f"[ChampionStatsSync] 101 item list fetch failed: {exc}")
        return {}

    return {
        str(item.get("itemId")): {
            "id": int(item.get("itemId")) if str(item.get("itemId")).isdigit() else item.get("itemId"),
            "name": item.get("name") or str(item.get("itemId")),
            "imageUrl": _https_url(item.get("iconPath")),
        }
        for item in items
        if isinstance(item, dict) and item.get("itemId")
    }


@lru_cache(maxsize=1)
def _tencent_summoner_lookup() -> dict[str, dict[str, Any]]:
    try:
        response = requests.get(TENCENT_SUMMONER_LIST_URL, timeout=15)
        response.raise_for_status()
        payload = response.json()
        spells = payload.get("summonerskill", {}) if isinstance(payload, dict) else {}
    except Exception as exc:
        rich_logger.warning(f"[ChampionStatsSync] 101 summoner list fetch failed: {exc}")
        return {}

    return {
        str(spell_id): {
            "id": int(spell_id) if str(spell_id).isdigit() else spell_id,
            "name": spell.get("name") or str(spell_id),
            "imageUrl": _https_url(spell.get("icon")),
        }
        for spell_id, spell in spells.items()
        if isinstance(spell, dict)
    }


def _tencent_build_rows(raw_json: str | None, lookup: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    if not raw_json:
        return []
    try:
        payload = json.loads(raw_json)
    except (TypeError, ValueError):
        return []

    rows = []
    for key in sorted(payload, key=lambda item: int(item) if str(item).isdigit() else str(item)):
        item = payload.get(key)
        if not isinstance(item, dict):
            continue
        ids = str(item.get("itemid") or item.get("spellid") or "").split("&")
        entries = []
        for entry_id in ids:
            entry = lookup.get(str(entry_id))
            if entry:
                entries.append(dict(entry))
        if not entries:
            continue
        rows.append(
            {
                "entries": entries,
                "pickRate": _qq_rate(item.get("showrate")),
                "winRate": _qq_rate(item.get("winrate")),
                "play": _normalize_count(item.get("igamecnt")),
            }
        )
    return rows


def _tencent_item_stat_rows(raw_json: str | None, lookup: dict[str, dict[str, Any]], limit: int = 80) -> list[dict[str, Any]]:
    if not raw_json:
        return []
    try:
        payload = json.loads(raw_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(payload, list):
        return []

    rows = []
    for item in payload[:limit]:
        if not isinstance(item, dict):
            continue
        entry = lookup.get(str(item.get("itemid")))
        if not entry:
            continue
        rows.append(
            {
                "entries": [dict(entry)],
                "pickRate": _qq_rate(item.get("showrate")),
                "winRate": _qq_rate(item.get("winrate")),
                "play": _normalize_count(item.get("igamecnt")),
            }
        )
    return rows


def _tencent_skill_build_rows(raw_json: str | None) -> list[dict[str, Any]]:
    if not raw_json:
        return []
    try:
        payload = json.loads(raw_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(payload, dict):
        return []

    key_map = {"1": "Q", "2": "W", "3": "E", "4": "R"}
    rows = []
    for key in sorted(payload, key=lambda item: int(item) if str(item).isdigit() else str(item)):
        item = payload.get(key)
        if not isinstance(item, dict):
            continue
        qwe = [key_map.get(part, part) for part in str(item.get("qwe") or "").split("&") if part]
        levels = []
        sks = item.get("sks") if isinstance(item.get("sks"), dict) else {}
        for sub_key in sorted(sks, key=lambda value: int(value) if str(value).isdigit() else str(value)):
            sub_item = sks.get(sub_key)
            if not isinstance(sub_item, dict):
                continue
            levels.append(
                {
                    "order": [key_map.get(part, part) for part in str(sub_item.get("sk") or "").split("&") if part],
                    "pickRate": _qq_rate(sub_item.get("sk_s")),
                    "winRate": _qq_rate(sub_item.get("sk_w")),
                }
            )
        rows.append(
            {
                "order": qwe,
                "pickRate": _qq_rate(item.get("qwe_s")),
                "winRate": _qq_rate(item.get("qwe_w")),
                "levelOrders": levels,
            }
        )
    return rows


def _tencent_lane_stats(lane_payload: dict[str, Any]) -> dict[str, Any]:
    games = _normalize_count(lane_payload.get("igamecnt")) or 0
    wins = _normalize_count(lane_payload.get("wincnt")) or 0
    seconds = _normalize_count(lane_payload.get("timeplayed")) or 0
    return {
        "date": lane_payload.get("dtstatdate"),
        "games": games,
        "wins": wins,
        "winRate": _qq_rate(lane_payload.get("lanewinrate")),
        "roleRate": _qq_rate(lane_payload.get("lanrate")),
        "pickRate": _qq_rate(lane_payload.get("lanshowrate")),
        "rank": _normalize_count(lane_payload.get("champlanorder")),
        "kills": _normalize_count(lane_payload.get("kills")),
        "deaths": _normalize_count(lane_payload.get("deaths")),
        "assists": _normalize_count(lane_payload.get("assists")),
        "kda": _qq_rate(lane_payload.get("kda")),
        "avgGameTime": round(seconds / games, 2) if games else None,
        "goldEarned": _normalize_count(lane_payload.get("goldearned")),
        "goldPerGame": _normalize_count(lane_payload.get("goldearnedpergame")),
        "minionsKilled": _normalize_count(lane_payload.get("minionskilled")),
        "damageShare": _qq_rate(lane_payload.get("damagerate")),
        "damageToChampionShare": _qq_rate(lane_payload.get("damagetochamprate")),
        "killParticipation": _qq_rate(lane_payload.get("killsrate")),
    }


def _tencent_rune_page_rows(lane_payload: dict[str, Any]) -> list[dict[str, Any]]:
    rune_lookup = _tencent_rune_lookup()
    try:
        mainvice = json.loads(lane_payload.get("mainviceperk") or "{}")
        detail = json.loads(lane_payload.get("perkdetail") or "{}")
    except (TypeError, ValueError):
        return []

    pages = []
    for key in sorted(mainvice, key=lambda item: int(item) if str(item).isdigit() else str(item)):
        item = mainvice.get(key)
        if not isinstance(item, dict):
            continue
        detail_group = detail.get(str(key), {}) if isinstance(detail, dict) else {}
        first_detail = None
        if isinstance(detail_group, dict) and detail_group:
            first_detail = detail_group.get("1") or next(iter(detail_group.values()))

        rune_ids = []
        if isinstance(first_detail, dict):
            rune_ids = [part for part in str(first_detail.get("perk") or "").split("&") if part]
        main_ids = rune_ids[:4] or [str(item.get("mainperk") or "")]
        sub_ids = rune_ids[4:6]
        stat_ids = rune_ids[6:]

        def rune_entry(rune_id: str, active: bool = True) -> dict[str, Any]:
            rune = dict(rune_lookup.get(str(rune_id), {"id": rune_id, "name": str(rune_id)}))
            rune["isActive"] = active
            return rune

        main_runes = [rune_entry(rune_id) for rune_id in main_ids if rune_id]
        sub_runes = [rune_entry(rune_id) for rune_id in sub_ids if rune_id]
        stat_runes = [rune_entry(rune_id) for rune_id in stat_ids if rune_id]
        primary_style_name = item.get("mainname") or (main_runes[0].get("styleName") if main_runes else None)
        sub_style_name = item.get("viceperk") or (sub_runes[0].get("styleName") if sub_runes else None)
        pages.append(
            {
                "id": int(key) if str(key).isdigit() else key,
                "play": _normalize_count(item.get("igamecnt")),
                "pick_rate": (_qq_rate(item.get("showrate")) or 0) / 100,
                "win_rate": _qq_rate(item.get("winrate")),
                "primary_perk_style": {
                    "id": key,
                    "name": primary_style_name or "-",
                    "image_url": main_runes[0].get("image_url") if main_runes else None,
                },
                "perk_sub_style": {
                    "id": key,
                    "name": sub_style_name or "-",
                    "image_url": sub_runes[0].get("image_url") if sub_runes else None,
                },
                "primary_rune": main_runes[0] if main_runes else None,
                "builds": [
                    {
                        "main_runes": [main_runes],
                        "sub_runes": [sub_runes + stat_runes],
                    }
                ],
            }
        )
    return pages


def _tencent_skill_order(raw_json: str | None) -> list[str]:
    if not raw_json:
        return []
    try:
        payload = json.loads(raw_json)
    except (TypeError, ValueError):
        return []
    first = payload.get("1") if isinstance(payload, dict) else None
    if not isinstance(first, dict):
        first = next((item for item in payload.values() if isinstance(item, dict)), None) if isinstance(payload, dict) else None
    qwe = str((first or {}).get("qwe") or "").split("&")
    key_map = {"1": "Q", "2": "W", "3": "E", "4": "R"}
    return [key_map.get(item, item) for item in qwe if item]


def fetch_tencent_champion_build_detail(champion: str, position: str = "jungle") -> dict[str, Any]:
    meta = _champion_meta_by_key().get(str(champion or "").lower())
    hero_id = meta.get("heroId") if meta else None
    if not hero_id:
        raise ValueError(f"101 champion id not found: {champion}")

    response = requests.get(TENCENT_GUIDE_DETAIL_URL.format(hero_id=hero_id), headers=OPGG_HEADERS, timeout=20)
    response.raise_for_status()
    payload = _parse_js_object_payload(response.content.decode("gbk", errors="ignore"))
    lanes = ((payload.get("list") or {}).get("championLane") or {}) if isinstance(payload, dict) else {}
    lane = TENCENT_LANE_BY_POSITION.get(str(position or "").lower(), str(position or "jungle").lower())
    lane_payload = lanes.get(lane) if isinstance(lanes, dict) else None
    if not isinstance(lane_payload, dict):
        lane_payload = next((value for value in lanes.values() if isinstance(value, dict)), {})

    item_lookup = _tencent_item_lookup()
    summoner_lookup = _tencent_summoner_lookup()
    skill_builds = _tencent_skill_build_rows(lane_payload.get("skilljson"))
    result = {
        "source": "101.qq.com",
        "champion": str(meta.get("alias") or champion).lower(),
        "position": lane,
        "region": "cn",
        "tier": None,
        "patch": lane_payload.get("gameversion") or payload.get("gameVer"),
        "gameType": "ranked",
        "fetchedAt": datetime.now().isoformat(timespec="seconds"),
        "laneStats": _tencent_lane_stats(lane_payload),
        "counters": [],
        "runePages": _tencent_rune_page_rows(lane_payload),
        "singleRuneBuilds": [],
        "summonerSpells": _tencent_build_rows(lane_payload.get("spellidjson"), summoner_lookup),
        "items": {
            "starterItems": _tencent_build_rows(lane_payload.get("itemoutjson"), item_lookup),
            "boots": _tencent_build_rows(lane_payload.get("shoesjson"), item_lookup),
            "coreItems": _tencent_build_rows(lane_payload.get("core3itemjson"), item_lookup),
            "itemStats": _tencent_item_stat_rows(lane_payload.get("hold3"), item_lookup),
        },
        "skills": [],
        "passive": None,
        "skillOrder": _tencent_skill_order(lane_payload.get("skilljson")),
        "skillBuilds": skill_builds,
        "cacheFallback": False,
    }
    result["dataCompleteness"] = {
        "runePages": len(result["runePages"]),
        "summonerSpells": len(result["summonerSpells"]),
        "starterItems": len(result["items"]["starterItems"]),
        "boots": len(result["items"]["boots"]),
        "coreItems": len(result["items"]["coreItems"]),
        "itemStats": len(result["items"]["itemStats"]),
        "skillOrder": len(result["skillOrder"]),
        "skillBuilds": len(skill_builds),
    }
    return _attach_official_skill_fallback(result)


@lru_cache(maxsize=256)
def _official_skill_payload(champion_key: str) -> dict[str, Any]:
    meta = _champion_meta_by_key().get(str(champion_key or "").lower())
    hero_id = meta.get("heroId") if meta else None
    if not hero_id:
        return {"skills": [], "passive": None}

    try:
        response = requests.get(TENCENT_HERO_DETAIL_URL.format(hero_id=hero_id), timeout=15)
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        rich_logger.warning(f"[ChampionStatsSync] Tencent skill fallback failed {champion_key}: {exc}")
        return {"skills": [], "passive": None}

    spells = data.get("spells", []) if isinstance(data, dict) else []
    skill_order = {"Q": 0, "W": 1, "E": 2, "R": 3}
    skills: list[dict[str, Any]] = []
    seen_skill_keys: set[str] = set()
    passive: dict[str, Any] | None = None
    for spell in spells:
        if not isinstance(spell, dict):
            continue
        raw_key = str(spell.get("spellKey") or "").strip()
        key = raw_key.upper()
        entry = {
            "key": key,
            "name": spell.get("name") or key,
            "description": spell.get("description") or spell.get("dynamicDescription"),
            "image_url": spell.get("abilityIconPath"),
            "video_url": spell.get("abilityVideoPath"),
        }
        if raw_key.lower() == "passive":
            passive = {
                "name": spell.get("name") or "琚姩",
                "description": spell.get("description") or spell.get("dynamicDescription"),
                "image_url": spell.get("abilityIconPath"),
                "video_url": spell.get("abilityVideoPath"),
            }
        elif key in skill_order and key not in seen_skill_keys:
            seen_skill_keys.add(key)
            skills.append(entry)

    skills.sort(key=lambda item: skill_order.get(str(item.get("key")), 99))
    return {"skills": skills, "passive": passive}


def _attach_official_skill_fallback(payload: dict[str, Any]) -> dict[str, Any]:
    champion_key = str(payload.get("champion") or "")
    official = _official_skill_payload(champion_key)
    if not payload.get("skills") and official.get("skills"):
        payload["skills"] = official["skills"]
    if not payload.get("passive") and official.get("passive"):
        payload["passive"] = official["passive"]
    return payload


def _merge_build_detail(primary: dict[str, Any], build: dict[str, Any]) -> dict[str, Any]:
    merged = dict(primary)
    items = dict(merged.get("items") or {})
    build_items = build.get("items") if isinstance(build.get("items"), dict) else {}

    for key in ("starterItems", "boots", "coreItems", "itemStats"):
        if build_items.get(key):
            items[key] = build_items.get(key)
    if items:
        merged["items"] = items

    for key in ("laneStats", "runePages", "singleRuneBuilds", "summonerSpells", "skillOrder", "skillBuilds"):
        if build.get(key):
            merged[key] = build.get(key)

    completeness = dict(merged.get("dataCompleteness") or {})
    completeness.update(build.get("dataCompleteness") or {})
    merged["dataCompleteness"] = completeness
    merged["buildSource"] = build.get("source")
    return _attach_official_skill_fallback(_normalize_detail_payload(merged))


def _extract_next_payload(html: str) -> dict[str, Any]:
    scripts = re.findall(r"<script[^>]*>([\s\S]*?)</script>", html, re.IGNORECASE)
    for script in scripts:
        if "positionWinRate" not in script:
            continue
        match = re.match(r"self\.__next_f\.push\((\[.*\])\)$", script.strip(), re.DOTALL)
        if not match:
            continue
        flight_frame = json.loads(match.group(1))
        if len(flight_frame) < 2 or not isinstance(flight_frame[1], str):
            continue
        _, _, json_part = flight_frame[1].partition(":")
        parsed = json.loads(json_part)
        if isinstance(parsed, list) and len(parsed) >= 4 and isinstance(parsed[3], dict):
            payload = parsed[3]
            if isinstance(payload.get("filterData"), list) and not all(
                isinstance(row, dict) for row in payload.get("data", [])
            ):
                payload["data"] = payload["filterData"]
            if isinstance(payload.get("data"), list):
                return payload

    raise ValueError("positionWinRate data was not found in the OP.GG page")


def _detect_patch(payload: dict[str, Any], html: str, requested_patch: str | None) -> str | None:
    if requested_patch:
        return requested_patch

    for row in payload.get("data", []):
        image_url = row.get("image_url") if isinstance(row, dict) else ""
        match = re.search(r"/lol/([0-9.]+)/champion/", str(image_url))
        if match:
            version = match.group(1)
            parts = version.split(".")
            return ".".join(parts[:2]) if len(parts) >= 2 else version

    match = re.search(r'"metaLatestVersion":"([^"]+)"', html)
    return match.group(1) if match else None


def _extract_versions(html: str) -> list[str]:
    match = re.search(
        r'<select[^>]+id="desktopMainFilterVersion"[\s\S]*?</select>',
        html,
        re.IGNORECASE,
    )
    if not match:
        return []

    versions = []
    for value in re.findall(r'<option[^>]+value="([^"]+)"', match.group(0), re.IGNORECASE):
        version = value.strip()
        if version and version not in versions:
            versions.append(version)
    return versions


def _add_champion_ids(payload: dict[str, Any]) -> None:
    id_by_key = _champion_id_by_key()
    for row in payload.get("data", []):
        if not isinstance(row, dict) or row.get("champion_id"):
            continue
        champion_id = id_by_key.get(str(row.get("key", "")).lower())
        if champion_id:
            row["champion_id"] = champion_id


def _add_rank_delta(payload: dict[str, Any]) -> None:
    for row in payload.get("data", []):
        if not isinstance(row, dict):
            continue

        rank = row.get("positionRank") or row.get("totalRank") or row.get("rank")
        tier_data = row.get("positionTierData") if isinstance(row.get("positionTierData"), dict) else {}
        previous_rank = tier_data.get("rank_prev_patch")
        same_patch_rank = tier_data.get("rank_prev")
        previous_patch_rank = tier_data.get("rank_prev_patch")

        if same_patch_rank is not None:
            row["positionRankPrev"] = same_patch_rank
        if previous_rank is not None:
            row["positionRankDeltaBase"] = previous_rank
        if previous_patch_rank is not None:
            row["positionRankPrevPatch"] = previous_patch_rank

        try:
            row["positionRankDelta"] = int(float(previous_rank)) - int(float(rank))
        except (TypeError, ValueError):
            row["positionRankDelta"] = None


def _add_derived_metrics(payload: dict[str, Any]) -> None:
    for row in payload.get("data", []):
        if not isinstance(row, dict):
            continue
        pick_rate = float(row.get("positionPickRate") or 0)
        ban_rate = float(row.get("positionBanRate") or 0)
        win_rate = float(row.get("positionWinRate") or 0)
        role_rate = float(row.get("positionRoleRate") or 0)
        row["presenceRate"] = round(pick_rate + ban_rate, 4)
        row["positionRoleRatePercent"] = round(role_rate * 100 if role_rate <= 1 else role_rate, 4)
        row["winRateDeltaFromEven"] = round(win_rate - 50, 4)
        row["dataCompleteness"] = {
            "hasChampionId": bool(row.get("champion_id")),
            "hasCounters": any(isinstance(counter, dict) for counter in row.get("positionCounters", [])),
            "hasRankDelta": row.get("positionRankDelta") is not None,
        }


def _api_counter_rows(counters: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    rows = []
    for counter in counters or []:
        if not isinstance(counter, dict):
            continue
        play = _normalize_count(counter.get("play"))
        win = _normalize_count(counter.get("win"))
        rows.append(
            {
                "champion_id": counter.get("champion_id"),
                "play": play,
                "win": win,
                "counterWinRate": round((win / play) * 100, 4) if play and win is not None else None,
            }
        )
    return rows


def _normalize_opgg_api_payload(api_payload: dict[str, Any], region: str, tier: str, game_type: str) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for champion in api_payload.get("data", []):
        if not isinstance(champion, dict):
            continue
        champion_id = champion.get("id")
        for position in champion.get("positions", []) or []:
            if not isinstance(position, dict):
                continue
            stats = position.get("stats") if isinstance(position.get("stats"), dict) else {}
            tier_data = stats.get("tier_data") if isinstance(stats.get("tier_data"), dict) else {}
            rank = tier_data.get("rank")
            previous_rank = tier_data.get("rank_prev")
            row = {
                "champion_id": champion_id,
                "positionName": position.get("name"),
                "positionWinRate": round(float(stats.get("win_rate") or 0) * 100, 4),
                "positionPickRate": round(float(stats.get("pick_rate") or 0) * 100, 4),
                "positionBanRate": round(float(stats.get("ban_rate") or 0) * 100, 4),
                "positionRoleRate": stats.get("role_rate"),
                "positionTierData": tier_data,
                "positionTier": tier_data.get("tier"),
                "positionRank": rank,
                "positionRankPrev": previous_rank,
                "positionRankPrevPatch": tier_data.get("rank_prev_patch"),
                "positionCounters": _api_counter_rows(position.get("counters")),
                "play": stats.get("play"),
                "kda": stats.get("kda"),
            }
            try:
                row["positionRankDelta"] = int(float(previous_rank)) - int(float(rank))
            except (TypeError, ValueError):
                row["positionRankDelta"] = None
            rows.append(row)

    rows.sort(
        key=lambda row: (
            int(row.get("positionTier") if row.get("positionTier") is not None else 99),
            int(row.get("positionRank") if row.get("positionRank") is not None else 9999),
            -float(row.get("positionPickRate") or 0),
        )
    )
    meta = api_payload.get("meta") if isinstance(api_payload.get("meta"), dict) else {}
    payload = {
        "data": rows,
        "source": "op.gg api",
        "region": region or "global",
        "tier": tier or "all",
        "patch": meta.get("version"),
        "gameType": game_type or "SOLORANKED",
        "versions": [meta.get("version")] if meta.get("version") else [],
        "fetchedAt": meta.get("analyzed_at") or datetime.now().isoformat(timespec="seconds"),
        "matchCount": meta.get("match_count"),
        "cacheFallback": False,
    }
    _add_derived_metrics(payload)
    return payload


def fetch_opgg_stats_api(
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "SOLORANKED",
) -> dict[str, Any]:
    params = {"hl": "zh_CN"}
    if tier:
        params["tier"] = tier
    if patch:
        params["patch"] = patch
    if game_type:
        params["type"] = game_type

    response = requests.get(
        OPGG_CHAMPION_API_URL.format(region=_safe_key(region or "global", "global")),
        params=params,
        headers=OPGG_HEADERS,
        timeout=20,
    )
    response.raise_for_status()
    return _normalize_opgg_api_payload(response.json(), region, tier, game_type)


def _extract_counter_detail(flight_text: str) -> dict[str, Any]:
    target_index = flight_text.find('"targetChampion"')
    if target_index < 0:
        return {"counters": []}

    data_index = flight_text.rfind('{"data":[', 0, target_index)
    block = _extract_balanced_json(flight_text, data_index)
    counters = block.get("data", []) if isinstance(block, dict) else []
    return {
        "targetChampion": block.get("targetChampion") if isinstance(block, dict) else None,
        "counters": counters if isinstance(counters, list) else [],
    }


def _normalize_detail_payload(payload: dict[str, Any]) -> dict[str, Any]:
    meta_by_key = _champion_meta_by_key()
    for counter in payload.get("counters", []):
        if not isinstance(counter, dict) or not isinstance(counter.get("champion"), dict):
            continue
        champion = counter["champion"]
        key = str(champion.get("key") or "").lower()
        meta = meta_by_key.get(key)
        if meta:
            champion["name"] = meta["name"]
            champion["image_url"] = meta["image_url"]
            champion["champion_id"] = meta["heroId"]
    return payload


def _extract_rune_detail(flight_text: str) -> dict[str, Any]:
    block = _extract_json_after(flight_text, '"data":{"rune_pages"')
    if not isinstance(block, dict):
        return {"runePages": [], "singleRuneBuilds": []}
    return {
        "runePages": block.get("rune_pages") or [],
        "singleRuneBuilds": block.get("single_rune_builds") or [],
    }


def _extract_skill_detail(flight_text: str) -> dict[str, Any]:
    skill_index = flight_text.find('"skills":[{"key"')
    if skill_index < 0:
        return {"skills": [], "passive": None, "skillOrder": []}

    block_start = flight_text.rfind("{", 0, skill_index)
    block = _extract_balanced_json(flight_text, block_start)
    skills = block.get("skills", []) if isinstance(block, dict) else []
    passive = block.get("passive") if isinstance(block, dict) else None

    order_window = flight_text[skill_index : skill_index + 7000]
    skill_order: list[str] = []
    for key in re.findall(r'"children":"([QWER])"', order_window):
        if key in {"Q", "W", "E", "R"}:
            skill_order.append(key)
        if len(skill_order) >= 15:
            break

    return {
        "skills": skills if isinstance(skills, list) else [],
        "passive": passive if isinstance(passive, dict) else None,
        "skillOrder": skill_order,
    }


def _extract_rows_by_prefix(flight_text: str, prefixes: list[str], image_kind: str) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {prefix: [] for prefix in prefixes}
    row_pattern = re.compile(r'"tr","(' + "|".join(re.escape(prefix) for prefix in prefixes) + r')_(\d+)"')
    matches = list(row_pattern.finditer(flight_text))
    for index, match in enumerate(matches):
        prefix = match.group(1)
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else start + 7000
        row = flight_text[start:end]
        image_pattern = (
            r'"metaId":(\d+)[\s\S]{0,500}?"src":"([^"]+/'
            + re.escape(image_kind)
            + r'/[^"]+)"[\s\S]{0,160}?"alt":"([^"]+)"'
        )
        entries = [
            {"id": int(item_id), "imageUrl": image_url, "name": name}
            for item_id, image_url, name in re.findall(image_pattern, row)
        ]
        if not entries:
            continue
        rates = [_normalize_float(value) for value in re.findall(r'"children":\[(\d+(?:\.\d+)?),"%"\]', row)]
        play_match = re.search(r'"children":\["([\d,]+)"," ","场次"\]', row)
        result[prefix].append(
            {
                "entries": entries,
                "pickRate": rates[0] if rates else None,
                "winRate": rates[-1] if rates else None,
                "play": _normalize_count(play_match.group(1) if play_match else None),
            }
        )
    return result


def _extract_item_detail(flight_text: str) -> dict[str, Any]:
    rows = _extract_rows_by_prefix(flight_text, ["starter_items", "boots", "core_items"], "item")
    return {
        "starterItems": rows.get("starter_items", []),
        "boots": rows.get("boots", []),
        "coreItems": rows.get("core_items", []),
    }


def _extract_spell_detail(flight_text: str) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    matches = list(re.finditer(r'"spells_table_(\d+)"', flight_text))
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else start + 5000
        row_text = flight_text[start:end]
        entries = [
            {"id": int(spell_id), "imageUrl": image_url, "name": name}
            for spell_id, image_url, name in re.findall(
                r'"metaId":(\d+)[\s\S]{0,600}?"src":"([^"]+/spell/[^"]+)"[\s\S]{0,200}?"alt":"([^"]+)"',
                row_text,
            )
        ]
        if not entries:
            continue
        rates = [_normalize_float(value) for value in re.findall(r'"children":\[(\d+(?:\.\d+)?),"%"\]', row_text)]
        pick_match = re.search(
            r'"children":(\d+(?:\.\d+)?)\}\],\["\$","span",null,\{"className":"text-gray-500","children":"[\d,]+ 场次"',
            row_text,
        )
        play_match = re.search(r'"children":"([\d,]+) 场次"', row_text) or re.search(
            r'"children":\["([\d,]+)"," ","场次"\]', row_text
        )
        row = {
            "entries": entries,
            "pickRate": _normalize_float(pick_match.group(1) if pick_match else None),
            "winRate": rates[-1] if rates else None,
            "play": _normalize_count(play_match.group(1) if play_match else None),
        }
        key = ",".join(str(entry.get("id")) for entry in row.get("entries", []))
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def fetch_opgg_stats(
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "SOLORANKED",
) -> dict[str, Any]:
    try:
        return fetch_opgg_stats_api(region=region, tier=tier, patch=patch, game_type=game_type)
    except Exception as api_exc:
        rich_logger.warning(f"[ChampionStatsSync] OP.GG API fetch failed, falling back to page parser: {api_exc}")

    params = {"tier": tier or "all"}
    if region and region != "global":
        params["region"] = region
    if patch:
        params["patch"] = patch
    if game_type and game_type != "SOLORANKED":
        params["type"] = game_type

    response = requests.get(OPGG_CHAMPIONS_URL, params=params, headers=OPGG_HEADERS, timeout=25)
    _ensure_opgg_html_response(response, "champion stats")

    payload = _extract_next_payload(response.text)
    _add_champion_ids(payload)
    _add_rank_delta(payload)
    _add_derived_metrics(payload)

    detected_patch = _detect_patch(payload, response.text, patch)
    versions = _extract_versions(response.text)
    payload.update(
        {
            "source": "op.gg",
            "region": region or "global",
            "tier": tier or "all",
            "patch": detected_patch,
            "gameType": game_type or "SOLORANKED",
            "versions": versions or ([detected_patch] if detected_patch else []),
            "fetchedAt": datetime.now().isoformat(timespec="seconds"),
            "cacheFallback": False,
        }
    )
    return payload


def fetch_opgg_champion_detail(
    champion: str,
    position: str = "adc",
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "ranked",
    target_champion: str | None = None,
) -> dict[str, Any]:
    champion_key = _safe_key(champion, "champion")
    target_champion_key = _safe_key(target_champion, "") if target_champion else None
    position_key = OPGG_ROLE_PATHS.get(str(position or "adc").upper(), str(position or "adc").lower())
    query = {
        "region": region or "global",
        "tier": tier or "all",
        "type": game_type or "ranked",
    }
    if patch:
        query["patch"] = patch

    build_query = dict(query)
    if target_champion_key:
        build_query["target_champion"] = target_champion_key

    build_url = f"{OPGG_CHAMPIONS_URL}/{champion_key}/build/{position_key}"
    counters_url = f"{OPGG_CHAMPIONS_URL}/{champion_key}/counters/{position_key}"

    build_response = requests.get(build_url, params=build_query, headers=OPGG_HEADERS, timeout=25)
    _ensure_opgg_html_response(build_response, "champion build")
    counter_response = requests.get(counters_url, params=query, headers=OPGG_HEADERS, timeout=25)
    _ensure_opgg_html_response(counter_response, "champion counters")

    build_flight = _extract_flight_text(build_response.text)
    counter_flight = _extract_flight_text(counter_response.text)
    if not build_flight and not counter_flight:
        raise ValueError("OP.GG champion detail returned no Flight payload")
    runes = _extract_rune_detail(build_flight)
    skills = _extract_skill_detail(build_flight)

    payload = {
        "source": "op.gg",
        "champion": champion_key,
        "position": position_key,
        "region": region or "global",
        "tier": tier or "all",
        "patch": patch,
        "gameType": game_type or "ranked",
        "targetChampion": target_champion_key,
        "matchupBuild": bool(target_champion_key),
        "urls": {
            "build": build_response.url,
            "counters": counter_response.url,
        },
        "counters": _extract_counter_detail(counter_flight).get("counters", []),
        "runePages": runes.get("runePages", []),
        "singleRuneBuilds": runes.get("singleRuneBuilds", []),
        "summonerSpells": _extract_spell_detail(build_flight),
        "items": _extract_item_detail(build_flight),
        "skills": skills.get("skills", []),
        "passive": skills.get("passive"),
        "skillOrder": skills.get("skillOrder", []),
        "fetchedAt": datetime.now().isoformat(timespec="seconds"),
        "cacheFallback": False,
    }
    payload["dataCompleteness"] = {
        "counters": len(payload["counters"]),
        "runePages": len(payload["runePages"]),
        "summonerSpells": len(payload["summonerSpells"]),
        "starterItems": len(payload["items"].get("starterItems", [])),
        "boots": len(payload["items"].get("boots", [])),
        "coreItems": len(payload["items"].get("coreItems", [])),
        "skills": len(payload["skills"]),
        "hasPassive": bool(payload.get("passive")),
    }
    return _attach_official_skill_fallback(_normalize_detail_payload(payload))


def get_cached_opgg_champion_detail(
    champion: str,
    position: str = "adc",
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    allow_sync: bool = True,
    game_type: str = "ranked",
    target_champion: str | None = None,
) -> dict[str, Any]:
    target_champion_key = _safe_key(target_champion, "") if target_champion else None
    path = _detail_cache_path(champion, position, region, tier, patch or "latest", game_type, target_champion_key)
    cached = _load_json(path)
    if cached and _detail_has_content(cached) and (
        not allow_sync or (
            _is_fresh(path, DETAIL_CACHE_TTL_SECONDS) and _detail_has_rich_build_content(cached)
        )
    ):
        cached["cacheFallback"] = False
        return _attach_official_skill_fallback(_normalize_detail_payload(cached))

    if allow_sync:
        try:
            payload = fetch_opgg_champion_detail(
                champion=champion,
                position=position,
                region=region,
                tier=tier,
                patch=patch,
                game_type=game_type,
                target_champion=target_champion_key,
            )
            if not _detail_has_content(payload):
                raise ValueError("OP.GG champion detail payload is empty")
            if not target_champion_key and not _detail_has_rich_build_content(payload):
                try:
                    build_payload = fetch_tencent_champion_build_detail(champion=champion, position=position)
                    if _detail_has_build_content(build_payload):
                        payload = _merge_build_detail(payload, build_payload)
                except Exception as qq_exc:
                    rich_logger.error(f"[ChampionStatsSync] 101 champion detail fallback failed: {qq_exc}")
            _write_json(path, payload)
            return payload
        except Exception as exc:
            rich_logger.error(f"[ChampionStatsSync] OP.GG champion detail sync failed: {exc}")
            if not target_champion_key:
                try:
                    payload = fetch_tencent_champion_build_detail(champion=champion, position=position)
                    if _detail_has_build_content(payload):
                        _write_json(path, payload)
                        return payload
                except Exception as qq_exc:
                    rich_logger.error(f"[ChampionStatsSync] 101 champion detail sync failed: {qq_exc}")

    if cached:
        cached["cacheFallback"] = True
        return _attach_official_skill_fallback(_normalize_detail_payload(cached))

    fallback_payload = {
        "source": "op.gg",
        "champion": champion,
        "position": position,
        "region": region,
        "tier": tier,
        "patch": patch,
        "gameType": game_type,
        "targetChampion": target_champion_key,
        "matchupBuild": bool(target_champion_key),
        "counters": [],
        "runePages": [],
        "singleRuneBuilds": [],
        "summonerSpells": [],
        "items": {"starterItems": [], "boots": [], "coreItems": []},
        "skills": [],
        "passive": None,
        "skillOrder": [],
        "cacheFallback": True,
    }
    return _attach_official_skill_fallback(fallback_payload)


def fetch_opgg_region_icon(region: str = "global") -> str:
    region = region or "global"
    if region == "cn":
        return CHINA_FLAG_SVG

    params = {"tier": "all"}
    if region != "global":
        params["region"] = region

    response = requests.get(OPGG_CHAMPIONS_URL, params=params, headers=OPGG_HEADERS, timeout=25)
    _ensure_opgg_html_response(response, "region icon")
    match = re.search(r'<label for="desktopMainFilterRegion"[\s\S]*?</label>', response.text)
    if not match:
        raise ValueError(f"OP.GG region icon not found: {region}")
    svg_match = re.search(r"(<svg[\s\S]*?</svg>)", match.group(0))
    if not svg_match:
        raise ValueError(f"OP.GG region SVG not found: {region}")
    return svg_match.group(1)


def get_cached_opgg_region_icon(region: str = "global") -> str:
    region = region or "global"
    if region == "cn":
        return CHINA_FLAG_SVG

    path = _region_icon_path(region)
    try:
        with open(path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        pass

    svg = fetch_opgg_region_icon(region)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        file.write(svg)
    return svg


def get_cached_opgg_role_icon(role: str = "TOP") -> str:
    role_key = str(role or "TOP").upper()
    role_key = {"JUNGLE": "JUN", "BOT": "ADC", "BOTTOM": "ADC", "SUPPORT": "SUP"}.get(role_key, role_key)
    svg = OPGG_ROLE_SVGS.get(role_key, OPGG_ROLE_SVGS["TOP"])

    path = _role_icon_path(role_key)
    try:
        with open(path, "r", encoding="utf-8") as file:
            cached = file.read()
        if cached.strip():
            return cached
    except FileNotFoundError:
        pass

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        file.write(svg)
    return svg


def sync_opgg_stats(
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    game_type: str = "SOLORANKED",
) -> dict[str, Any]:
    with _status_lock:
        _last_status["running"] = True

    try:
        payload = fetch_opgg_stats(region=region, tier=tier, patch=patch, game_type=game_type)
        cache_patch = patch or payload.get("patch") or "latest"
        _write_json(_cache_path(region, tier, cache_patch, game_type), payload)
        if not patch:
            _write_json(_cache_path(region, tier, "latest", game_type), payload)

        with _status_lock:
            _last_status.update(
                {
                    "running": False,
                    "lastSuccessAt": payload["fetchedAt"],
                    "lastError": None,
                    "lastPayload": {
                        "region": payload["region"],
                        "tier": payload["tier"],
                        "patch": payload.get("patch"),
                        "gameType": payload.get("gameType"),
                        "rows": len(payload.get("data", [])),
                    },
                }
            )
        _write_json(STATUS_PATH, get_sync_status())
        rich_logger.info(
            f"[ChampionStatsSync] OP.GG sync completed region={region} tier={tier} patch={payload.get('patch')}"
        )
        return payload
    except Exception as exc:
        with _status_lock:
            _last_status.update(
                {
                    "running": False,
                    "lastErrorAt": datetime.now().isoformat(timespec="seconds"),
                    "lastError": str(exc),
                }
            )
        try:
            _write_json(STATUS_PATH, get_sync_status())
        except Exception:
            pass
        rich_logger.error(f"[ChampionStatsSync] OP.GG sync failed: {exc}")
        raise


def get_cached_opgg_stats(
    region: str = "global",
    tier: str = "all",
    patch: str | None = None,
    allow_sync: bool = True,
    game_type: str = "SOLORANKED",
) -> dict[str, Any]:
    region = region or "global"
    tier = tier or "all"
    patch = patch or DEFAULT_PATCH or None

    if patch:
        cached, path = _load_stats_cache(region, tier, patch, game_type)
        if cached:
            return _prepare_cached_stats(cached, requested_region=region)

        if allow_sync:
            try:
                return sync_opgg_stats(region=region, tier=tier, patch=patch, game_type=game_type)
            except Exception:
                pass

    cached, _ = _load_stats_cache(region, tier, "latest", game_type)
    if cached:
        return _prepare_cached_stats(cached, requested_region=region)

    if allow_sync:
        try:
            return sync_opgg_stats(region=region, tier=tier, patch=patch, game_type=game_type)
        except Exception:
            pass

    return {
        "data": [],
        "source": "op.gg",
        "region": region,
        "tier": tier,
        "patch": patch,
        "gameType": game_type,
        "cacheFallback": True,
    }


def get_sync_status() -> dict[str, Any]:
    status = _load_json(STATUS_PATH) or {}
    with _status_lock:
        merged = {**status, **_last_status}
    merged["intervalSeconds"] = DEFAULT_INTERVAL_SECONDS
    return merged


def _scheduler_loop(interval_seconds: int) -> None:
    while True:
        try:
            sync_opgg_stats(region="global", tier="all", patch=DEFAULT_PATCH or None, game_type="SOLORANKED")
        except Exception:
            pass
        time.sleep(interval_seconds)


def start_champion_stats_scheduler(interval_seconds: int = DEFAULT_INTERVAL_SECONDS) -> None:
    global _scheduler_started
    if _scheduler_started or os.getenv("CHAMPION_STATS_SYNC_DISABLED") == "1":
        return

    _scheduler_started = True
    thread = threading.Thread(
        target=_scheduler_loop,
        args=(max(60, interval_seconds),),
        name="champion-stats-sync",
        daemon=True,
    )
    thread.start()
