"""Probe LPL official match detail endpoints for live-updating fields."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from Data_CrawlProcess.team_player_stats_sync import (
    HEADERS,
    LPL_MATCH_DETAIL_URL,
    LPL_MATCH_SOURCE_URL,
    get_cached_pro_schedule,
)


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBE_ROOT = os.path.join(BASE_DIR, "data", "json", "live_probe", "lpl")
CN_TZ = timezone(timedelta(hours=8))
LIVE_FIELD_HINTS = (
    "kill",
    "death",
    "assist",
    "gold",
    "money",
    "dragon",
    "drake",
    "baron",
    "tower",
    "turret",
    "herald",
    "elder",
    "cs",
    "creep",
    "damage",
    "ward",
    "vision",
    "level",
    "item",
    "equip",
    "gameTime",
    "duration",
    "matchStatus",
    "teamInfos",
    "playerInfos",
)


def _safe_id(value: Any) -> str:
    text = str(value or "unknown").strip()
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", text) or "unknown"


def _json_path(match_id: str) -> str:
    return os.path.join(PROBE_ROOT, f"{_safe_id(match_id)}.json")


def _load_previous(match_id: str) -> dict[str, Any] | None:
    try:
        with open(_json_path(match_id), "r", encoding="utf-8") as file:
            payload = json.load(file)
        return payload if isinstance(payload, dict) else None
    except FileNotFoundError:
        return None


def _save_snapshot(match_id: str, payload: dict[str, Any]) -> None:
    os.makedirs(PROBE_ROOT, exist_ok=True)
    with open(_json_path(match_id), "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _fetch_lpl_detail_uncached(match_id: str) -> dict[str, Any]:
    response = requests.get(
        LPL_MATCH_DETAIL_URL,
        params={"matchId": str(match_id)},
        headers={**HEADERS, "referer": "https://lpl.qq.com/web202301/schedule.html"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("LPL matchDetail returned non-JSON object")
    return payload


def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        rows: dict[str, Any] = {}
        for key, nested in value.items():
            next_prefix = f"{prefix}.{key}" if prefix else str(key)
            rows.update(_flatten(nested, next_prefix))
        return rows
    if isinstance(value, list):
        rows = {}
        for index, nested in enumerate(value):
            rows.update(_flatten(nested, f"{prefix}[{index}]"))
        return rows
    if isinstance(value, (str, int, float, bool)) or value is None:
        return {prefix: value}
    return {prefix: str(value)}


def _changed_fields(previous: dict[str, Any] | None, current: dict[str, Any]) -> list[dict[str, Any]]:
    if not previous:
        return []

    old_flat = _flatten(previous.get("raw") or previous)
    new_flat = _flatten(current.get("raw") or current)
    changed = []
    for path in sorted(set(old_flat) | set(new_flat)):
        if old_flat.get(path) != new_flat.get(path):
            changed.append(
                {
                    "path": path,
                    "before": old_flat.get(path),
                    "after": new_flat.get(path),
                    "liveHint": any(hint.lower() in path.lower() for hint in LIVE_FIELD_HINTS),
                }
            )
    return changed[:200]


def _field_inventory(raw: dict[str, Any]) -> dict[str, Any]:
    flat = _flatten(raw)
    hinted = sorted(
        path
        for path in flat
        if any(hint.lower() in path.lower() for hint in LIVE_FIELD_HINTS)
    )
    return {
        "totalFields": len(flat),
        "candidateLiveFields": hinted[:300],
        "candidateLiveFieldCount": len(hinted),
    }


def _compact_game(game: dict[str, Any]) -> dict[str, Any]:
    teams = []
    for team in game.get("teamInfos") or []:
        players = []
        for player in team.get("playerInfos") or []:
            battle = player.get("battleDetail") or {}
            damage = player.get("damageDetail") or {}
            taken = player.get("DamageTakenDetail") or {}
            vision = player.get("visionDetail") or {}
            other = player.get("otherDetail") or {}
            players.append(
                {
                    "playerId": player.get("playerId"),
                    "playerName": player.get("playerName"),
                    "playerLocation": player.get("playerLocation"),
                    "heroId": player.get("heroId"),
                    "heroName": player.get("heroName"),
                    "kills": battle.get("kills"),
                    "deaths": battle.get("death"),
                    "assists": battle.get("assist"),
                    "kda": battle.get("kda"),
                    "killParticipation": battle.get("attendWarRate"),
                    "gold": other.get("golds"),
                    "goldDiff": other.get("oppositeGoldsDiff"),
                    "goldDiffAt15": other.get("oppositeGoldsDiffAt15"),
                    "cs": other.get("creepsKilled"),
                    "level": other.get("level"),
                    "damage": damage.get("heroDamage"),
                    "damageShare": damage.get("damageRate"),
                    "damagePerMinute": damage.get("damagePerMinute"),
                    "damageTaken": taken.get("damageTaken"),
                    "visionScore": vision.get("visionScore"),
                    "wardsPlaced": vision.get("wardPlaced"),
                    "wardsKilled": vision.get("wardKilled"),
                    "summonerSpells": [
                        {
                            "id": player.get("spell1Id"),
                            "name": player.get("spell1Name"),
                            "iconKey": player.get("spell1IconKey"),
                        },
                        {
                            "id": player.get("spell2Id"),
                            "name": player.get("spell2Name"),
                            "iconKey": player.get("spell2IconKey"),
                        },
                    ],
                    "runes": player.get("perkRunes") or [],
                    "items": player.get("items") or player.get("equipments"),
                    "roleItem": player.get("roleItem"),
                    "trinketItem": player.get("trinketItem"),
                }
            )
        teams.append(
            {
                "teamId": team.get("teamId"),
                "teamSide": team.get("teamSide"),
                "teamName": team.get("teamName"),
                "kills": team.get("kills"),
                "gold": team.get("golds"),
                "towers": team.get("turretAmount"),
                "inhibitors": team.get("inhibitKills"),
                "dragons": team.get("dragonAmount"),
                "dragonDetail": team.get("dragonDetail"),
                "dragonSoul": team.get("dragonSpirit"),
                "dragonSoulType": team.get("dragonSpiritType"),
                "barons": team.get("baronAmount"),
                "baronIncome": team.get("baronIncome"),
                "riftHeralds": team.get("riftHeraldAmount"),
                "voidGrubs": team.get("voidGrubAmount"),
                "atakhan": team.get("atakhanAmount"),
                "elderDragons": team.get("elderDragonAmount"),
                "firstDragon": team.get("isFirstDragon"),
                "firstTower": team.get("isFirstTurret"),
                "firstHerald": team.get("isFirstRiftHerald"),
                "bans": team.get("banHeroList") or [],
                "players": players,
            }
        )
    return {
        "gameId": game.get("gameId") or game.get("matchInfoId"),
        "gameIndex": game.get("gameIndex") or game.get("index") or game.get("gameNumber"),
        "gameStatus": game.get("gameStatus") or game.get("matchStatus"),
        "gameTime": game.get("gameTime") or game.get("duration") or game.get("gameDuration"),
        "winnerTeamId": game.get("matchWin") or game.get("gameWin"),
        "teams": teams,
    }


def _compact_snapshot(match_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data") or {}
    games = data.get("matchInfos") or []
    return {
        "matchId": data.get("matchId") or match_id,
        "matchName": data.get("matchName"),
        "matchStatus": data.get("matchStatus"),
        "matchTime": data.get("matchTime"),
        "winnerTeamId": data.get("matchWin"),
        "teamA": {
            "id": data.get("teamAId"),
            "name": data.get("teamAName"),
            "score": data.get("teamAScore"),
        },
        "teamB": {
            "id": data.get("teamBId"),
            "name": data.get("teamBName"),
            "score": data.get("teamBScore"),
        },
        "games": [_compact_game(game) for game in games if isinstance(game, dict)],
        "sourceUrl": LPL_MATCH_SOURCE_URL.format(match_id=match_id),
    }


def _match_sort_time(match: dict[str, Any]) -> datetime:
    raw = match.get("time") or match.get("beginAt") or match.get("scheduledAt")
    if not raw:
        return datetime.max.replace(tzinfo=CN_TZ)
    text = str(raw).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=CN_TZ)
        return parsed.astimezone(CN_TZ)
    except ValueError:
        return datetime.max.replace(tzinfo=CN_TZ)


def lpl_live_candidates(limit: int = 8) -> list[dict[str, Any]]:
    schedule = get_cached_pro_schedule("LPL", allow_sync=True)
    matches = schedule.get("matches") or []
    now = datetime.now(CN_TZ)

    def score(match: dict[str, Any]) -> tuple[int, float]:
        status = str(match.get("status") or "").lower()
        start = _match_sort_time(match)
        running_rank = 0 if status in {"running", "live", "in_progress"} else 1
        window_rank = 0 if abs((start - now).total_seconds()) <= 6 * 3600 else 1
        return running_rank + window_rank, abs((start - now).total_seconds())

    rows = sorted(matches, key=score)[:limit]
    return [
        {
            "matchId": row.get("id"),
            "status": row.get("status"),
            "statusLabel": row.get("statusLabel"),
            "time": row.get("time") or row.get("beginAt") or row.get("scheduledAt"),
            "homeTeam": row.get("homeTeam"),
            "awayTeam": row.get("awayTeam"),
            "score": [row.get("homeScore"), row.get("awayScore")],
            "detailAvailable": row.get("detailAvailable"),
        }
        for row in rows
        if row.get("id")
    ]


def probe_lpl_live_sources(match_id: str | None = None, save: bool = True) -> dict[str, Any]:
    candidates = lpl_live_candidates()
    selected_id = str(match_id or (candidates[0]["matchId"] if candidates else ""))
    if not selected_id:
        return {
            "ok": False,
            "error": "No LPL match candidate found",
            "checkedAt": datetime.now(CN_TZ).isoformat(timespec="seconds"),
            "candidates": candidates,
        }

    previous = _load_previous(selected_id)
    raw = _fetch_lpl_detail_uncached(selected_id)
    snapshot = {
        "checkedAt": datetime.now(CN_TZ).isoformat(timespec="seconds"),
        "matchId": selected_id,
        "compact": _compact_snapshot(selected_id, raw),
        "inventory": _field_inventory(raw),
        "raw": raw,
    }
    changes = _changed_fields(previous, snapshot)
    if save:
        _save_snapshot(selected_id, snapshot)

    return {
        "ok": True,
        "checkedAt": snapshot["checkedAt"],
        "matchId": selected_id,
        "candidateCount": len(candidates),
        "candidates": candidates,
        "compact": snapshot["compact"],
        "inventory": snapshot["inventory"],
        "changedFieldCount": len(changes),
        "changedFields": changes,
        "hadPreviousSnapshot": previous is not None,
        "saved": save,
        "snapshotPath": _json_path(selected_id) if save else None,
    }
