# -*- coding: utf-8 -*-
"""Sync pro team and player stats from OP.GG Esports and LPL official data."""

from __future__ import annotations

import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

import requests

from Data_CrawlProcess import env
from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()

OPGG_HOME_URL = "https://esports.op.gg/"
OPGG_LEAGUE_URL = "https://esports.op.gg/leagues/{league}"
OPGG_TEAM_URL = "https://esports.op.gg/teams/{team_id}/{acronym}"
OPGG_PLAYER_URL = "https://esports.op.gg/players/{player_id}/{nick_name}"
OPGG_MATCH_URL = "https://esports.op.gg/matches/{match_id}/{slug}"
OPGG_GRAPHQL_URL = "https://esports.op.gg/matches/graphql"
LPL_SEASONS_URL = "https://lol.qq.com/act/AutoCMS/publish/LOLWeb/EventdataTab/EventdataTab.js"
LPL_SCHEDULE_URL = "https://lpl.qq.com/web201612/data/LOL_MATCH2_MATCH_HOMEPAGE_BMATCH_LIST_{season_id}.js"
LPL_MATCH_DETAIL_URL = "https://open.tjstats.com/match-auth-app/open/v1/compound/matchDetail"
LPL_MATCH_SOURCE_URL = "https://lpl.qq.com/es/stats.shtml?bmid={match_id}"
LPL_STATS_BASE_URL = "https://open.tjstats.com/match-auth-app/open/v1"

CACHE_ROOT = os.path.join(env.project_root, "data", "json", "pro_stats")
STATUS_PATH = os.path.join(CACHE_ROOT, "sync_status.json")
LEGACY_TEAMS_CACHE_PATH = os.path.join(CACHE_ROOT, "teams.json")
LEGACY_PLAYERS_CACHE_PATH = os.path.join(CACHE_ROOT, "players.json")

DEFAULT_INTERVAL_SECONDS = int(os.getenv("PRO_STATS_SYNC_INTERVAL", str(60 * 60 * 6)))
DEFAULT_LEAGUE = os.getenv("PRO_STATS_DEFAULT_LEAGUE", "LPL").upper()
DEFAULT_SEASON_ID = os.getenv("PRO_STATS_SEASON_ID", "")
DEFAULT_STAGE_IDS = os.getenv("PRO_STATS_STAGE_IDS", "")
MAX_GRAPHQL_WORKERS = int(os.getenv("PRO_STATS_GRAPHQL_WORKERS", "8"))

HEADERS = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "zh-CN,zh;q=0.9",
    "authorization": env.AUTHORIZATION,
    "referer": "https://esports.op.gg/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
}

ROLE_MAP = {
    "TOP": "TOP",
    "JUG": "JUN",
    "JUN": "JUN",
    "JUNGLE": "JUN",
    "MID": "MID",
    "AD": "ADC",
    "ADC": "ADC",
    "BOT": "ADC",
    "BOTTOM": "ADC",
    "SUP": "SUP",
    "SUPPORT": "SUP",
}

CHINESE_STAGE_ORDER = {
    "\u4e00": 1,
    "\u4e8c": 2,
    "\u4e09": 3,
    "\u56db": 4,
    "\u4e94": 5,
    "\u516d": 6,
    "\u4e03": 7,
    "\u516b": 8,
    "\u4e5d": 9,
    "\u5341": 10,
}

PLAYERS_BY_TOURNAMENT_AND_TEAM_QUERY = """
query ListPlayersByTournamentAndTeam($tournamentId: ID!, $teamId: ID!) {
  playersByTournamentAndTeam(tournamentId: $tournamentId, teamId: $teamId) {
    player {
      id
      nickName
      firstName
      lastName
      imageUrl
      birthday
      nationality
      position
      stream
      youtube
      twitter
      facebook
      instagram
      discord
      currentTeam {
        id
        name
        acronym
        imageUrl
        imageUrlDarkMode
        imageUrlLightMode
      }
    }
    playerStat {
      playerId
      teamId
      tournamentId
      position
      games
      wins
      loses
      winRate
      kda
      kills
      deaths
      assists
      wardsPlaced
      wardsKilled
      dpm
      dtpm
      gpm
      cspm
      dpgr
      firstBlood
      firstTower
      proStat {
        opScore
        grade
      }
    }
  }
}
"""

TOURNAMENT_OVERVIEW_QUERY = """
query InternationalListTournaments($serieId: ID!) {
  tournaments(serieId: $serieId) {
    id
    name
    beginAt
    endAt
    standings {
      win
      lose
      setWin
      setLose
      point
      position
      previously
      team {
        id
        name
        acronym
        imageUrl
        imageUrlDarkMode
        imageUrlLightMode
        nationality
        foundedAt
        website
        twitter
      }
    }
    matches {
      id
      name
      beginAt
      endAt
      scheduledAt
      status
      homeScore
      awayScore
      winnerTeam {
        id
        acronym
        name
        imageUrl
        imageUrlDarkMode
      }
      homeTeam {
        id
        acronym
        name
        imageUrl
        imageUrlDarkMode
      }
      awayTeam {
        id
        acronym
        name
        imageUrl
        imageUrlDarkMode
      }
    }
  }
}
"""

_status_lock = threading.Lock()
_scheduler_started = False
_last_status: dict[str, Any] = {
    "running": False,
    "lastSuccessAt": None,
    "lastErrorAt": None,
    "lastError": None,
    "lastPayload": None,
}


def _safe_key(value: str | None, fallback: str = "lpl") -> str:
    raw = (value or fallback).strip().lower()
    return re.sub(r"[^a-z0-9_.+-]+", "_", raw) or fallback


def _league_key(league: str | None = None) -> str:
    return str(league or DEFAULT_LEAGUE or "LPL").upper()


def _cache_path(kind: str, league: str | None = None) -> str:
    return os.path.join(CACHE_ROOT, _safe_key(_league_key(league)), f"{kind}.json")


def _write_json(path: str, payload: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    os.replace(temp_path, path)


def _load_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as file:
            payload = json.load(file)
        return payload if isinstance(payload, dict) else None
    except FileNotFoundError:
        return None
    except Exception as exc:
        rich_logger.error(f"[ProStatsSync] read cache failed {path}: {exc}")
        return None


def _request_json(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    response = requests.get(url, params=params, headers=HEADERS, timeout=25)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError(f"unexpected JSON response: {url}")
    return payload


def _request_html(url: str, params: dict[str, Any] | None = None) -> str:
    response = requests.get(
        url,
        params=params,
        headers={**HEADERS, "accept": "text/html,application/xhtml+xml"},
        timeout=25,
    )
    response.raise_for_status()
    return response.text


def _normalize_role(value: Any) -> str:
    return ROLE_MAP.get(str(value or "").upper(), str(value or "").upper())


def _number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _text_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _first_present(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _extract_next_page_props(html: str) -> dict[str, Any]:
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        raise ValueError("OP.GG Esports page did not expose __NEXT_DATA__")
    next_data = json.loads(match.group(1))
    return next_data.get("props", {}).get("pageProps", {}) or {}


def _pick_logo(entity: dict[str, Any]) -> Any:
    return entity.get("imageUrl") or entity.get("imageUrlDarkMode") or entity.get("imageUrlLightMode")


def _slug(value: Any) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return slug or "detail"


def _match_slug(home: dict[str, Any] | None, away: dict[str, Any] | None, name: Any = "") -> str:
    home_name = (home or {}).get("acronym") or (home or {}).get("name")
    away_name = (away or {}).get("acronym") or (away or {}).get("name")
    return _slug(" vs ".join(str(item) for item in [home_name, away_name] if item) or name)


def _parse_lpl_time(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if "T" in text:
        return text
    try:
        return datetime.strptime(text, "%Y-%m-%d %H:%M:%S").isoformat(timespec="seconds") + "+08:00"
    except ValueError:
        return text


def _lpl_status(value: Any) -> str:
    raw = str(value or "").strip()
    if raw in {"2", "live", "in_progress"}:
        return "running"
    if raw in {"3", "finished", "completed"}:
        return "finished"
    if raw in {"4", "canceled", "cancelled"}:
        return "canceled"
    return "scheduled"


def _compact_socials(entity: dict[str, Any]) -> dict[str, Any]:
    return {
        "website": entity.get("website"),
        "stream": entity.get("stream"),
        "youtube": entity.get("youtube"),
        "twitter": entity.get("twitter"),
        "facebook": entity.get("facebook"),
        "instagram": entity.get("instagram"),
        "discord": entity.get("discord"),
    }


def _compact_series(series: list[dict[str, Any]] | None, limit: int = 12) -> list[dict[str, Any]]:
    rows = []
    for serie in (series or [])[:limit]:
        if not isinstance(serie, dict):
            continue
        rows.append(
            {
                "id": serie.get("id"),
                "name": serie.get("name"),
                "year": serie.get("year"),
                "season": serie.get("season"),
                "beginAt": serie.get("beginAt"),
                "endAt": serie.get("endAt"),
                "league": serie.get("league"),
                "tournaments": [
                    {
                        "id": tournament.get("id"),
                        "name": tournament.get("name"),
                        "beginAt": tournament.get("beginAt"),
                        "endAt": tournament.get("endAt"),
                    }
                    for tournament in (serie.get("tournaments") or [])
                    if isinstance(tournament, dict)
                ],
            }
        )
    return rows


def _compact_careers(careers: list[dict[str, Any]] | None, limit: int = 16) -> list[dict[str, Any]]:
    rows = []
    for career in (careers or [])[:limit]:
        if not isinstance(career, dict):
            continue
        team = career.get("team") or {}
        serie = career.get("serie") or {}
        rows.append(
            {
                "team": {
                    "id": team.get("id"),
                    "name": team.get("name"),
                    "acronym": team.get("acronym"),
                    "logo": _pick_logo(team),
                },
                "serie": {
                    "id": serie.get("id"),
                    "name": serie.get("name"),
                    "year": serie.get("year"),
                    "season": serie.get("season"),
                    "beginAt": serie.get("beginAt"),
                    "endAt": serie.get("endAt"),
                },
            }
        )
    return rows


@lru_cache(maxsize=256)
def fetch_opgg_team_profile(team_id: str, acronym: str = "") -> dict[str, Any]:
    page_props = _extract_next_page_props(
        _request_html(
            OPGG_TEAM_URL.format(team_id=team_id, acronym=_slug(acronym)),
            params={"hl": "zh_CN"},
        )
    )
    team = page_props.get("team") or {}
    return {
        "id": team.get("id"),
        "name": team.get("name"),
        "acronym": team.get("acronym"),
        "nationality": team.get("nationality"),
        "foundedAt": team.get("foundedAt"),
        "logo": _pick_logo(team),
        "currentLeague": team.get("currentLeague"),
        "socials": _compact_socials(team),
        "series": _compact_series(team.get("series"), limit=10),
        "wonSeries": _compact_series(team.get("wonSeries"), limit=10),
        "formerWonSeries": _compact_series(team.get("formerWonSeries"), limit=10),
        "formerly": [
            {
                "name": item.get("name"),
                "acronym": item.get("acronym"),
                "beginAt": item.get("beginAt"),
                "endAt": item.get("endAt"),
            }
            for item in (team.get("formerly") or [])[:10]
            if isinstance(item, dict)
        ],
        "source": "esports.op.gg",
    }


@lru_cache(maxsize=512)
def fetch_opgg_player_profile(player_id: str, nick_name: str = "") -> dict[str, Any]:
    profile_url = OPGG_PLAYER_URL.format(player_id=player_id, nick_name=_slug(nick_name))
    page_props = _extract_next_page_props(
        _request_html(
            profile_url,
            params={"hl": "zh_CN"},
        )
    )
    player = page_props.get("player") or {}
    current_team = player.get("currentTeam") or {}
    return {
        "id": player.get("id"),
        "nickName": player.get("nickName"),
        "firstName": player.get("firstName"),
        "lastName": player.get("lastName"),
        "imageUrl": player.get("imageUrl"),
        "birthday": player.get("birthday"),
        "nationality": player.get("nationality"),
        "position": player.get("position"),
        "currentTeam": {
            "id": current_team.get("id"),
            "name": current_team.get("name"),
            "acronym": current_team.get("acronym"),
            "logo": _pick_logo(current_team),
        } if current_team else None,
        "socials": _compact_socials(player),
        "weeklyPlayers": player.get("weeklyPlayers") or [],
        "series": _compact_series(player.get("series"), limit=10),
        "wonSeries": _compact_series(player.get("wonSeries"), limit=10),
        "careers": _compact_careers(player.get("careers"), limit=18),
        "profileUrl": profile_url,
        "source": "esports.op.gg",
    }


def fetch_opgg_leagues() -> list[dict[str, Any]]:
    page_props = _extract_next_page_props(_request_html(OPGG_HOME_URL, params={"hl": "zh_CN"}))
    leagues = page_props.get("leagues") or []
    result = []
    for league in leagues:
        latest = league.get("latestSerie") or league.get("recentSerie") or {}
        image_url = league.get("imageUrl")
        color_image_url = image_url.replace("@black.", ".") if isinstance(image_url, str) else image_url
        dark_image_url = image_url.replace("@black.", "@white.") if isinstance(image_url, str) else image_url
        result.append(
            {
                "id": league.get("id"),
                "name": league.get("name"),
                "shortName": league.get("shortName"),
                "region": league.get("region"),
                "imageUrl": league.get("imageUrl"),
                "imageUrlColor": color_image_url,
                "imageUrlDarkMode": dark_image_url,
                "imageUrlLightMode": image_url,
                "latestSerie": {
                    "id": latest.get("id"),
                    "year": latest.get("year"),
                    "season": latest.get("season"),
                    "beginAt": latest.get("beginAt"),
                    "endAt": latest.get("endAt"),
                },
            }
        )
    return result


def get_opgg_league_icon_url(league_short_name: str = DEFAULT_LEAGUE) -> str | None:
    league_key = _league_key(league_short_name)
    for league in fetch_opgg_leagues():
        if str(league.get("shortName") or "").upper() == league_key:
            return (
                league.get("imageUrlColor")
                or league.get("imageUrl")
                or league.get("imageUrlDarkMode")
                or league.get("imageUrlLightMode")
            )
    return None


def _select_serie(league: dict[str, Any]) -> dict[str, Any]:
    latest = league.get("latestSerie") or league.get("recentSerie") or {}
    latest_id = str(latest.get("id") or "")
    for serie in league.get("series", []) or []:
        if latest_id and str(serie.get("id")) == latest_id:
            return serie
    return (league.get("series") or [latest or {}])[0] or {}


def fetch_opgg_league_context(league_short_name: str = DEFAULT_LEAGUE) -> dict[str, Any]:
    league_key = _league_key(league_short_name)
    page_props = _extract_next_page_props(
        _request_html(OPGG_LEAGUE_URL.format(league=league_key), params={"hl": "zh_CN"})
    )
    league = page_props.get("league") or {}
    selected_serie = _select_serie(league)
    overview = fetch_opgg_tournament_overview(selected_serie.get("id"))
    teams_by_id: dict[str, dict[str, Any]] = {}
    teams_by_acronym: dict[str, dict[str, Any]] = {}
    tournaments: list[dict[str, Any]] = []

    for tournament in selected_serie.get("tournaments", []) or []:
        tournament_teams = []
        for roster in tournament.get("rosters", []) or []:
            team = roster.get("team") or {}
            team_id = str(team.get("id") or "")
            acronym = str(team.get("acronym") or "").upper()
            if not team_id or not acronym:
                continue
            teams_by_id[team_id] = team
            teams_by_acronym[acronym] = team
            tournament_teams.append(team_id)
        tournaments.append(
            {
                "id": tournament.get("id"),
                "name": tournament.get("name"),
                "serieId": selected_serie.get("id"),
                "serieName": selected_serie.get("name"),
                "year": selected_serie.get("year"),
                "season": selected_serie.get("season"),
                "beginAt": tournament.get("beginAt"),
                "endAt": tournament.get("endAt"),
                "teamIds": tournament_teams,
            }
        )

    return {
        "league": {
            "id": league.get("id"),
            "name": league.get("name"),
            "shortName": league.get("shortName") or league_key,
            "region": league.get("region"),
            "imageUrl": league.get("imageUrl"),
            "imageUrlColor": (
                league.get("imageUrl", "").replace("@black.", ".")
                if isinstance(league.get("imageUrl"), str)
                else league.get("imageUrl")
            ),
            "imageUrlDarkMode": (
                league.get("imageUrl", "").replace("@black.", "@white.")
                if isinstance(league.get("imageUrl"), str)
                else league.get("imageUrl")
            ),
            "imageUrlLightMode": league.get("imageUrl"),
        },
        "serie": {
            "id": selected_serie.get("id"),
            "name": selected_serie.get("name"),
            "year": selected_serie.get("year"),
            "season": selected_serie.get("season"),
            "beginAt": selected_serie.get("beginAt"),
            "endAt": selected_serie.get("endAt"),
        },
        "teamsById": teams_by_id,
        "teamsByAcronym": teams_by_acronym,
        "tournaments": tournaments,
        "tournamentOverview": overview.get("tournaments", []),
        "standingsByTeam": overview.get("standingsByTeam", {}),
        "matchesByTeam": overview.get("matchesByTeam", {}),
    }


def _graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(
        OPGG_GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers={**HEADERS, "content-type": "application/json"},
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise ValueError(payload["errors"][0].get("message") or "OP.GG GraphQL error")
    return payload.get("data") or {}


def fetch_opgg_tournament_overview(serie_id: str | int | None) -> dict[str, Any]:
    if not serie_id:
        return {"tournaments": [], "standingsByTeam": {}, "matchesByTeam": {}}

    data = _graphql(TOURNAMENT_OVERVIEW_QUERY, {"serieId": str(serie_id)})
    tournaments = data.get("tournaments") or []
    standings_by_team: dict[str, dict[str, Any]] = {}
    matches_by_team: dict[str, list[dict[str, Any]]] = {}

    for tournament in tournaments:
        tournament_info = {
            "id": tournament.get("id"),
            "name": tournament.get("name"),
            "beginAt": tournament.get("beginAt"),
            "endAt": tournament.get("endAt"),
        }
        for standing in tournament.get("standings") or []:
            team = standing.get("team") or {}
            team_id = str(team.get("id") or "")
            if not team_id:
                continue

            current = standings_by_team.setdefault(
                team_id,
                {
                    "teamId": team_id,
                    "team": team,
                    "matchWins": 0,
                    "matchLosses": 0,
                    "setWins": 0,
                    "setLosses": 0,
                    "points": 0,
                    "positions": [],
                    "previousPositions": [],
                    "tournaments": [],
                },
            )
            current["matchWins"] += int(_number(standing.get("win")))
            current["matchLosses"] += int(_number(standing.get("lose")))
            current["setWins"] += int(_number(standing.get("setWin")))
            current["setLosses"] += int(_number(standing.get("setLose")))
            current["points"] += _number(standing.get("point"))
            if standing.get("position") is not None:
                current["positions"].append(int(_number(standing.get("position"))))
            if standing.get("previously") is not None:
                current["previousPositions"].append(int(_number(standing.get("previously"))))
            current["tournaments"].append({**tournament_info, "standing": standing})

        for match in tournament.get("matches") or []:
            match_info = {**match, "tournament": tournament_info}
            for side in ("homeTeam", "awayTeam"):
                team = match.get(side) or {}
                team_id = str(team.get("id") or "")
                if team_id:
                    matches_by_team.setdefault(team_id, []).append(match_info)

    for standing in standings_by_team.values():
        positions = standing.pop("positions", [])
        previous_positions = standing.pop("previousPositions", [])
        standing["position"] = min(positions) if positions else None
        standing["previously"] = min(previous_positions) if previous_positions else None
        standing["matchesPlayed"] = standing["matchWins"] + standing["matchLosses"]
        standing["gamesPlayed"] = standing["setWins"] + standing["setLosses"]
        standing["matchWinRate"] = (
            standing["matchWins"] / standing["matchesPlayed"] if standing["matchesPlayed"] else 0
        )
        standing["setWinRate"] = standing["setWins"] / standing["gamesPlayed"] if standing["gamesPlayed"] else 0

    for team_matches in matches_by_team.values():
        team_matches.sort(key=lambda item: item.get("scheduledAt") or item.get("beginAt") or "")

    return {
        "tournaments": tournaments,
        "standingsByTeam": standings_by_team,
        "matchesByTeam": matches_by_team,
    }


def fetch_opgg_team_players(
    team_id: str,
    tournament_ids: list[str],
) -> tuple[list[dict[str, Any]], str | None]:
    fallback_rows: list[dict[str, Any]] = []
    fallback_tournament = None

    for tournament_id in tournament_ids:
        data = _graphql(
            PLAYERS_BY_TOURNAMENT_AND_TEAM_QUERY,
            {"tournamentId": str(tournament_id), "teamId": str(team_id)},
        )
        rows = data.get("playersByTournamentAndTeam") or []
        if rows and not fallback_rows:
            fallback_rows = rows
            fallback_tournament = str(tournament_id)
        if rows and any(row.get("playerStat") for row in rows):
            return rows, str(tournament_id)

    return fallback_rows, fallback_tournament


def _opgg_player_to_api(row: dict[str, Any], team: dict[str, Any], tournament_id: str | None) -> dict[str, Any]:
    player = row.get("player") or {}
    stat = row.get("playerStat") or {}
    team_id = str(team.get("id") or player.get("currentTeam", {}).get("id") or "")
    team_name = team.get("acronym") or player.get("currentTeam", {}).get("acronym") or team.get("name") or ""
    games = _number(stat.get("games"))
    kills = _number(stat.get("kills")) * games
    deaths = _number(stat.get("deaths")) * games
    assists = _number(stat.get("assists")) * games

    pro_stat = stat.get("proStat") or {}

    return {
        "playerId": player.get("id"),
        "playerName": player.get("nickName"),
        "realName": " ".join(
            item for item in [player.get("firstName"), player.get("lastName")] if item
        )
        or None,
        "playerLocation": _normalize_role(stat.get("position") or player.get("position")),
        "playerAvatar": player.get("imageUrl"),
        "teamId": team_id,
        "teamName": str(team_name).upper(),
        "teamFullName": team.get("name") or player.get("currentTeam", {}).get("name"),
        "teamLogo": _pick_logo(team) or _pick_logo(player.get("currentTeam", {})),
        "wins": int(_number(stat.get("wins"))),
        "loses": int(_number(stat.get("loses"))),
        "kda": _number(stat.get("kda")),
        "totalKills": round(kills, 2),
        "totalAssists": round(assists, 2),
        "totalDeath": round(deaths, 2),
        "matchCount": int(games),
        "boCount": int(games),
        "mvpCount": 0,
        "mvpVotes": _number(pro_stat.get("opScore")),
        "opScore": _number(pro_stat.get("opScore")),
        "opScoreGrade": pro_stat.get("grade"),
        "damagePercent": 0,
        "goldPercent": 0,
        "wardPlacedPerGame": round(_number(stat.get("wardsPlaced")), 2),
        "wardKilledPerGame": round(_number(stat.get("wardsKilled")), 2),
        "visionScorePerGame": round(_number(stat.get("wardsPlaced")) + _number(stat.get("wardsKilled")), 2),
        "damagePerMinute": round(_number(stat.get("dpm")), 2),
        "damageTakenPerMinute": round(_number(stat.get("dtpm")), 2),
        "goldPerMinute": round(_number(stat.get("gpm")), 2),
        "damagePerGold": round(_number(stat.get("dpm")) / _number(stat.get("gpm"), 1), 4),
        "creepScorePerGame": round(_number(stat.get("cspm")) * 30, 2),
        "creepScorePerMinute": round(_number(stat.get("cspm")), 2),
        "killParticipantPercent": 0,
        "killPerGame": round(_number(stat.get("kills")), 2),
        "assistPerGame": round(_number(stat.get("assists")), 2),
        "deathPerGame": round(_number(stat.get("deaths")), 2),
        "firstBloodPerGame": round(_number(stat.get("firstBlood")), 2),
        "firstTowerPerGame": round(_number(stat.get("firstTower")), 2),
        "winRate": _number(stat.get("winRate")),
        "games": int(games),
        "birthday": player.get("birthday"),
        "nationality": player.get("nationality"),
        "stream": player.get("stream"),
        "youtube": player.get("youtube"),
        "twitter": player.get("twitter"),
        "facebook": player.get("facebook"),
        "instagram": player.get("instagram"),
        "discord": player.get("discord"),
        "tournamentId": tournament_id,
        "source": "esports.op.gg",
    }


def _fetch_opgg_players_by_team(
    context: dict[str, Any],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, str | None]]:
    teams_by_id = context["teamsById"]
    tournaments_by_team: dict[str, list[str]] = {team_id: [] for team_id in teams_by_id}
    for tournament in context.get("tournaments", []):
        tournament_id = str(tournament.get("id") or "")
        for team_id in tournament.get("teamIds", []):
            if tournament_id and tournament_id not in tournaments_by_team.setdefault(team_id, []):
                tournaments_by_team[team_id].append(tournament_id)

    players_by_team: dict[str, list[dict[str, Any]]] = {}
    tournament_by_team: dict[str, str | None] = {}
    with ThreadPoolExecutor(max_workers=max(1, MAX_GRAPHQL_WORKERS)) as executor:
        futures = {
            executor.submit(fetch_opgg_team_players, team_id, tournaments): team_id
            for team_id, tournaments in tournaments_by_team.items()
        }
        for future in as_completed(futures):
            team_id = futures[future]
            try:
                rows, tournament_id = future.result()
            except Exception as exc:
                rich_logger.error(f"[ProStatsSync] OP.GG players failed team={team_id}: {exc}")
                rows, tournament_id = [], None
            team = teams_by_id.get(team_id, {})
            players_by_team[team_id] = [_opgg_player_to_api(row, team, tournament_id) for row in rows]
            tournament_by_team[team_id] = tournament_id

    return players_by_team, tournament_by_team


def _compact_match(match: dict[str, Any]) -> dict[str, Any]:
    home = match.get("homeTeam") or {}
    away = match.get("awayTeam") or {}
    winner = match.get("winnerTeam") or {}
    match_id = match.get("id")
    opgg_url = (
        OPGG_MATCH_URL.format(match_id=match_id, slug=_match_slug(home, away, match.get("name")))
        if match_id
        else None
    )
    return {
        "id": match.get("id"),
        "name": match.get("name"),
        "status": match.get("status"),
        "beginAt": match.get("beginAt"),
        "endAt": match.get("endAt"),
        "scheduledAt": match.get("scheduledAt"),
        "homeScore": match.get("homeScore"),
        "awayScore": match.get("awayScore"),
        "homeTeam": {
            "id": home.get("id"),
            "name": home.get("name"),
            "acronym": home.get("acronym"),
            "logo": _pick_logo(home),
        },
        "awayTeam": {
            "id": away.get("id"),
            "name": away.get("name"),
            "acronym": away.get("acronym"),
            "logo": _pick_logo(away),
        },
        "winnerTeam": {
            "id": winner.get("id"),
            "name": winner.get("name"),
            "acronym": winner.get("acronym"),
            "logo": _pick_logo(winner),
        } if winner else None,
        "tournament": match.get("tournament"),
        "source": match.get("source") or "esports.op.gg",
        "sourceUrl": match.get("sourceUrl") or opgg_url,
        "opggUrl": match.get("opggUrl") or opgg_url,
        "lplUrl": match.get("lplUrl"),
    }


def _opgg_match_to_schedule(match: dict[str, Any], league: dict[str, Any], serie: dict[str, Any]) -> dict[str, Any]:
    compact = _compact_match(match)
    time_value = compact.get("scheduledAt") or compact.get("beginAt")
    return {
        **compact,
        "id": str(compact.get("id") or ""),
        "league": league,
        "serie": serie,
        "time": time_value,
        "bestOf": None,
        "stage": (compact.get("tournament") or {}).get("name"),
        "statusLabel": str(compact.get("status") or "").title(),
        "dataSource": "esports.op.gg",
        "detailAvailable": bool(compact.get("sourceUrl") or compact.get("opggUrl")),
    }


@lru_cache(maxsize=512)
def fetch_opgg_match_detail(match_id: str, slug: str = "detail") -> dict[str, Any]:
    url = OPGG_MATCH_URL.format(match_id=match_id, slug=_slug(slug))
    html = requests.get(url, headers=HEADERS, timeout=25).text
    page_props = _extract_next_page_props(html)
    match = page_props.get("match") or {}
    home = match.get("homeTeam") or {}
    away = match.get("awayTeam") or {}
    winner = match.get("winnerTeam") or {}
    tournament = match.get("tournament") or {}
    return {
        "id": match.get("id") or match_id,
        "type": "opgg",
        "name": match.get("name") or f"{home.get('acronym') or home.get('name')} vs {away.get('acronym') or away.get('name')}",
        "status": match.get("status"),
        "beginAt": match.get("beginAt"),
        "endAt": match.get("endAt"),
        "scheduledAt": match.get("scheduledAt"),
        "homeScore": match.get("homeScore"),
        "awayScore": match.get("awayScore"),
        "homeTeam": {
            "id": home.get("id"),
            "name": home.get("name"),
            "acronym": home.get("acronym"),
            "logo": _pick_logo(home),
            "nationality": home.get("nationality"),
        },
        "awayTeam": {
            "id": away.get("id"),
            "name": away.get("name"),
            "acronym": away.get("acronym"),
            "logo": _pick_logo(away),
            "nationality": away.get("nationality"),
        },
        "winnerTeam": {
            "id": winner.get("id"),
            "name": winner.get("name"),
            "acronym": winner.get("acronym"),
            "logo": _pick_logo(winner),
        } if winner else None,
        "tournament": {
            "id": tournament.get("id"),
            "name": tournament.get("name"),
            "beginAt": tournament.get("beginAt"),
            "endAt": tournament.get("endAt"),
            "serie": tournament.get("serie"),
        },
        "ranks": match.get("ranks") or {},
        "streams": match.get("streams") or [],
        "videos": match.get("videos") or [],
        "sourceUrl": url,
    }


def fetch_opgg_pro_schedule(league: str = DEFAULT_LEAGUE) -> dict[str, Any]:
    league_key = _league_key(league)
    context = fetch_opgg_league_context(league_key)
    seen: set[str] = set()
    matches: list[dict[str, Any]] = []

    for team_matches in context.get("matchesByTeam", {}).values():
        for match in team_matches:
            match_id = str(match.get("id") or "")
            if not match_id or match_id in seen:
                continue
            seen.add(match_id)
            matches.append(_opgg_match_to_schedule(match, context.get("league") or {}, context.get("serie") or {}))

    matches.sort(key=lambda row: row.get("time") or "")
    return {
        "source": "esports.op.gg",
        "league": context.get("league"),
        "serie": context.get("serie"),
        "tournaments": context.get("tournaments", []),
        "matches": matches,
        "fetchedAt": datetime.now().isoformat(timespec="seconds"),
        "cacheFallback": False,
    }


def _lpl_team_from_acronym(acronym: str, opgg: dict[str, Any], lpl_team_id: Any = None) -> dict[str, Any]:
    team = (opgg.get("teamsByAcronym") or {}).get(str(acronym or "").upper(), {}) or {}
    cached_team = _cached_lpl_team(lpl_team_id, acronym)
    return {
        "id": lpl_team_id or team.get("id"),
        "opggTeamId": team.get("id"),
        "name": team.get("name") or cached_team.get("fullName") or cached_team.get("teamFullName") or str(acronym or "").upper(),
        "acronym": team.get("acronym") or str(acronym or "").upper(),
        "logo": _first_present(_pick_logo(team), cached_team.get("opggLogo"), cached_team.get("teamLogo")),
    }


def _cached_lpl_team(team_id: Any = None, acronym: Any = None) -> dict[str, Any]:
    cached = _load_json(_cache_path("teams", "LPL")) or {}
    rows = cached.get("data") or []
    team_id_text = str(team_id or "")
    acronym_key = str(acronym or "").upper()
    for row in rows:
        if team_id_text and str(row.get("teamId") or "") == team_id_text:
            return row
        if acronym_key and str(row.get("teamName") or row.get("acronym") or "").upper() == acronym_key:
            return row
    return {}


def _hydrate_lpl_schedule_team(team: dict[str, Any]) -> dict[str, Any]:
    cached_team = _cached_lpl_team(team.get("id"), team.get("acronym") or team.get("name"))
    if not cached_team:
        return team
    hydrated = dict(team)
    hydrated["name"] = _first_present(hydrated.get("name"), cached_team.get("fullName"), cached_team.get("teamFullName"))
    hydrated["acronym"] = _first_present(hydrated.get("acronym"), cached_team.get("teamName"))
    hydrated["logo"] = _first_present(hydrated.get("logo"), cached_team.get("opggLogo"), cached_team.get("teamLogo"))
    hydrated["opggTeamId"] = _first_present(hydrated.get("opggTeamId"), cached_team.get("opggTeamId"))
    return hydrated


def _hydrate_lpl_schedule_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if _league_key((payload.get("league") or {}).get("shortName") if isinstance(payload.get("league"), dict) else payload.get("league")) != "LPL":
        for match in payload.get("matches") or []:
            if match.get("opggUrl") or match.get("sourceUrl"):
                match["detailAvailable"] = True
                match["dataSource"] = match.get("dataSource") or "esports.op.gg"
        return payload
    for match in payload.get("matches") or []:
        for key in ("homeTeam", "awayTeam", "winnerTeam"):
            team = match.get(key)
            if isinstance(team, dict):
                match[key] = _hydrate_lpl_schedule_team(team)
    return payload


def _date_key_candidates(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    candidates = {text[:10]}
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone(timedelta(hours=8)))
        candidates.add(parsed.astimezone(timezone.utc).date().isoformat())
        candidates.add(parsed.astimezone(timezone(timedelta(hours=8))).date().isoformat())
    except ValueError:
        pass
    return [item for item in candidates if item]


def _opgg_match_lookup(matches: list[dict[str, Any]]) -> dict[tuple[str, str, str], dict[str, Any]]:
    lookup: dict[tuple[str, str, str], dict[str, Any]] = {}
    for match in matches:
        home = match.get("homeTeam") or {}
        away = match.get("awayTeam") or {}
        for date in _date_key_candidates(match.get("time") or match.get("scheduledAt") or match.get("beginAt")):
            key = (
                str(home.get("acronym") or "").upper(),
                str(away.get("acronym") or "").upper(),
                date,
            )
            if all(key):
                lookup[key] = match
    return lookup


def fetch_lpl_schedule(season_id: str | None = None, stage_ids: str | None = None) -> dict[str, Any]:
    season = resolve_lpl_season(season_id, stage_ids)
    season_id = str(season["seasonId"])
    opgg_context = fetch_opgg_league_context("LPL")
    opgg_schedule = fetch_opgg_pro_schedule("LPL")
    opgg_by_key = _opgg_match_lookup(opgg_schedule.get("matches", []))

    response = requests.get(
        LPL_SCHEDULE_URL.format(season_id=season_id),
        headers={**HEADERS, "referer": "https://lpl.qq.com/web202301/schedule.html"},
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json()
    rows = payload.get("msg") or []
    matches: list[dict[str, Any]] = []
    official_keys: set[tuple[str, str, str]] = set()
    official_opgg_ids: set[str] = set()

    for row in rows:
        home = _lpl_team_from_acronym(row.get("TeamShortNameA"), opgg_context, row.get("TeamA"))
        away = _lpl_team_from_acronym(row.get("TeamShortNameB"), opgg_context, row.get("TeamB"))
        time_value = _parse_lpl_time(row.get("MatchDate"))
        official_dates = _date_key_candidates(time_value)
        official_acronyms = (str(home.get("acronym") or "").upper(), str(away.get("acronym") or "").upper())
        for date_key in official_dates:
            official_keys.add((*official_acronyms, date_key))
        opgg_match = next((opgg_by_key.get((*official_acronyms, date_key), {}) for date_key in official_dates if opgg_by_key.get((*official_acronyms, date_key))), {})
        if opgg_match.get("id"):
            official_opgg_ids.add(str(opgg_match.get("id")))
        winner_id = row.get("TeamA") if str(row.get("MatchWin")) == "1" else row.get("TeamB") if str(row.get("MatchWin")) == "2" else None
        winner = home if winner_id and str(winner_id) == str(row.get("TeamA")) else away if winner_id else None
        lpl_url = LPL_MATCH_SOURCE_URL.format(match_id=row.get("bMatchId"))
        matches.append(
            {
                "id": str(row.get("bMatchId") or ""),
                "opggMatchId": opgg_match.get("id"),
                "name": row.get("bMatchName") or f"{home.get('acronym')} vs {away.get('acronym')}",
                "status": _lpl_status(row.get("MatchStatus")),
                "statusLabel": row.get("MatchStatusName") or _lpl_status(row.get("MatchStatus")),
                "beginAt": opgg_match.get("beginAt") or time_value,
                "endAt": opgg_match.get("endAt"),
                "scheduledAt": opgg_match.get("scheduledAt") or time_value,
                "time": opgg_match.get("scheduledAt") or time_value,
                "homeScore": int(_number(row.get("ScoreA"))) if row.get("ScoreA") not in (None, "") else None,
                "awayScore": int(_number(row.get("ScoreB"))) if row.get("ScoreB") not in (None, "") else None,
                "homeTeam": home,
                "awayTeam": away,
                "winnerTeam": winner,
                "league": opgg_context.get("league"),
                "serie": {
                    **(opgg_context.get("serie") or {}),
                    "seasonId": season_id,
                    "stageIds": season.get("stageIds"),
                    "name": season.get("name"),
                },
                "tournament": {
                    "id": row.get("GameTypeId"),
                    "name": row.get("GameTypeName"),
                    "week": row.get("GameProcName"),
                    "gameName": row.get("GameName"),
                },
                "stage": row.get("GameTypeName"),
                "round": row.get("GameProcName"),
                "bestOf": row.get("GameModeName"),
                "place": row.get("GamePlaceName"),
                "newsId": row.get("NewsId"),
                "videoIds": [row.get("Video1"), row.get("Video2"), row.get("Video3")],
                "chatIds": [row.get("Chat1"), row.get("Chat2"), row.get("Chat3")],
                "source": "lpl.qq.com + esports.op.gg",
                "dataSource": "lpl.qq.com",
                "sourceUrl": lpl_url,
                "lplUrl": lpl_url,
                "opggUrl": opgg_match.get("sourceUrl") or opgg_match.get("opggUrl"),
                "detailAvailable": str(row.get("MatchStatus")) == "3",
                "raw": row,
            }
        )

    for opgg_match in opgg_schedule.get("matches", []):
        home = opgg_match.get("homeTeam") or {}
        away = opgg_match.get("awayTeam") or {}
        opgg_key = (
            str(home.get("acronym") or "").upper(),
            str(away.get("acronym") or "").upper(),
            str(opgg_match.get("time") or "")[:10],
        )
        opgg_dates = _date_key_candidates(opgg_match.get("time") or opgg_match.get("scheduledAt") or opgg_match.get("beginAt"))
        if str(opgg_match.get("id") or "") in official_opgg_ids or opgg_key in official_keys or any((opgg_key[0], opgg_key[1], date_key) in official_keys for date_key in opgg_dates):
            continue
        fallback_match = dict(opgg_match)
        fallback_match.update(
            {
                "opggMatchId": opgg_match.get("id"),
                "dataSource": "esports.op.gg",
                "detailAvailable": True,
            }
        )
        matches.append(fallback_match)

    matches.sort(key=lambda item: item.get("time") or "")
    return {
        "source": "lpl.qq.com + esports.op.gg",
        "league": opgg_context.get("league"),
        "serie": {"seasonId": season_id, "stageIds": season.get("stageIds"), "name": season.get("name")},
        "season": season,
        "lastUpdate": payload.get("lastUpTime"),
        "matches": matches,
        "opggFallbackMatches": opgg_schedule.get("matches", []),
        "fetchedAt": datetime.now().isoformat(timespec="seconds"),
        "cacheFallback": False,
    }


@lru_cache(maxsize=256)
def fetch_lpl_match_detail(match_id: str) -> dict[str, Any]:
    payload = _request_json(LPL_MATCH_DETAIL_URL, params={"matchId": str(match_id)})
    data = payload.get("data") or {}
    return {
        "id": data.get("matchId") or match_id,
        "name": data.get("matchName"),
        "seasonName": data.get("seasonName"),
        "stageName": data.get("stageName"),
        "gameMode": data.get("gameMode"),
        "matchTime": data.get("matchTime"),
        "status": data.get("matchStatus"),
        "winnerTeamId": data.get("matchWin"),
        "homeTeam": {"id": data.get("teamAId"), "acronym": data.get("teamAName"), "score": data.get("teamAScore")},
        "awayTeam": {"id": data.get("teamBId"), "acronym": data.get("teamBName"), "score": data.get("teamBScore")},
        "games": data.get("matchInfos") or [],
        "source": "lpl.qq.com",
        "sourceUrl": LPL_MATCH_SOURCE_URL.format(match_id=match_id),
    }


def get_cached_pro_schedule(league: str | None = None, allow_sync: bool = True) -> dict[str, Any]:
    league_key = _league_key(league)
    path = _cache_path("schedule", league_key)
    cached = _load_json(path)
    if cached and not allow_sync:
        return _hydrate_lpl_schedule_payload(cached)
    try:
        payload = fetch_lpl_schedule() if league_key == "LPL" else fetch_opgg_pro_schedule(league_key)
        payload = _hydrate_lpl_schedule_payload(payload)
        _write_json(path, payload)
        return payload
    except Exception as exc:
        rich_logger.error(f"[ProStatsSync] schedule sync failed league={league_key}: {exc}")
        if cached:
            cached["cacheFallback"] = True
            return cached
        return {
            "source": "lpl.qq.com + esports.op.gg" if league_key == "LPL" else "esports.op.gg",
            "league": {"shortName": league_key},
            "matches": [],
            "cacheFallback": True,
            "error": str(exc),
        }


def _aggregate_opgg_team(
    team: dict[str, Any],
    players: list[dict[str, Any]],
    rank: int,
    standing: dict[str, Any] | None = None,
    matches: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    stats = [player for player in players if _number(player.get("games")) > 0]
    first = stats[0] if stats else {}
    standing = standing or {}
    matches = matches or []
    games = int(_number(standing.get("gamesPlayed")) or max((_number(player.get("games")) for player in stats), default=0))
    wins = int(_number(standing.get("setWins")) or (round(_number(first.get("winRate")) * games) if games else 0))
    match_count = int(_number(standing.get("matchesPlayed")) or games)
    match_wins = int(_number(standing.get("matchWins")) or wins)
    kills = sum(_number(player.get("killPerGame")) for player in stats)
    deaths = sum(_number(player.get("deathPerGame")) for player in stats)
    assists = sum(_number(player.get("assistPerGame")) for player in stats)
    finished_matches = [match for match in matches if str(match.get("status") or "").lower() == "finished"]
    upcoming_matches = [match for match in matches if str(match.get("status") or "").lower() not in {"finished", "canceled"}]
    roster = [
        {
            "playerId": player.get("playerId"),
            "playerName": player.get("playerName"),
            "playerLocation": player.get("playerLocation"),
            "playerAvatar": player.get("playerAvatar"),
            "kda": player.get("kda"),
            "games": player.get("games"),
            "winRate": player.get("winRate"),
        }
        for player in players
    ]

    return {
        "teamId": team.get("id"),
        "teamName": str(team.get("acronym") or team.get("name") or "").upper(),
        "fullName": team.get("name"),
        "acronym": str(team.get("acronym") or "").upper(),
        "teamLogo": _pick_logo(team),
        "opggLogo": _pick_logo(team),
        "rank": rank,
        "standingPosition": standing.get("position"),
        "previousStandingPosition": standing.get("previously"),
        "points": standing.get("points"),
        "matchCount": match_count,
        "matchWinCount": match_wins,
        "matchLossCount": int(_number(standing.get("matchLosses")) or max(match_count - match_wins, 0)),
        "gameCount": games,
        "gameWinCount": wins,
        "gameLossCount": int(_number(standing.get("setLosses")) or max(games - wins, 0)),
        "setWins": wins,
        "setLosses": int(_number(standing.get("setLosses")) or max(games - wins, 0)),
        "winningRate": _number(standing.get("setWinRate")) or _number(first.get("winRate")),
        "matchWinningRate": _number(standing.get("matchWinRate")) or (match_wins / match_count if match_count else 0),
        "totalKills": round(kills * games, 2) if games else 0,
        "totalAssists": round(assists * games, 2) if games else 0,
        "totalDeath": round(deaths * games, 2) if games else 0,
        "killPerGameTeam": round(kills, 2),
        "assistPerGameTeam": round(assists, 2),
        "deathPerGameTeam": round(deaths, 2),
        "wardPlacedPerGameTeam": round(sum(_number(player.get("wardPlacedPerGame")) for player in stats), 2),
        "wardKilledPerGameTeam": round(sum(_number(player.get("wardKilledPerGame")) for player in stats), 2),
        "goldPerGameTeam": round(sum(_number(player.get("goldPerMinute")) for player in stats) * 30, 2),
        "damagePerMinuteTeam": round(sum(_number(player.get("damagePerMinute")) for player in stats), 2),
        "damageTakenPerMinuteTeam": round(sum(_number(player.get("damageTakenPerMinute")) for player in stats), 2),
        "creepScorePerGameTeam": round(sum(_number(player.get("creepScorePerGame")) for player in stats), 2),
        "firstBloodPerGameTeam": round(sum(_number(player.get("firstBloodPerGame")) for player in stats), 2),
        "firstTowerPerGameTeam": round(sum(_number(player.get("firstTowerPerGame")) for player in stats), 2),
        "baronControlRate": 0,
        "drakeControlRate": 0,
        "turretDestroyPerGameTeam": 0,
        "timePerGameTeam": 0,
        "finishedMatches": len(finished_matches),
        "scheduledMatches": len(upcoming_matches),
        "recentMatches": [_compact_match(match) for match in finished_matches[-5:]],
        "upcomingMatches": [_compact_match(match) for match in upcoming_matches[:3]],
        "roster": roster,
        "recentMatchesAll": [_compact_match(match) for match in finished_matches[-12:]],
        "upcomingMatchesAll": [_compact_match(match) for match in upcoming_matches[:12]],
        "standings": standing.get("tournaments", []),
        "nationality": team.get("nationality"),
        "foundedAt": team.get("foundedAt"),
        "website": team.get("website"),
        "twitter": team.get("twitter"),
        "source": "esports.op.gg",
    }


def fetch_opgg_pro_stats(league: str = DEFAULT_LEAGUE) -> dict[str, Any]:
    context = fetch_opgg_league_context(league)
    teams_by_id = context["teamsById"]
    players_by_team, tournament_by_team = _fetch_opgg_players_by_team(context)

    teams = []
    players = []
    standings_by_team = context.get("standingsByTeam", {})
    matches_by_team = context.get("matchesByTeam", {})

    for index, team in enumerate(teams_by_id.values(), start=1):
        team_id = str(team.get("id") or "")
        team_players = players_by_team.get(team_id, [])
        players.extend(team_players)
        teams.append(
            _aggregate_opgg_team(
                team,
                team_players,
                index,
                standings_by_team.get(team_id),
                matches_by_team.get(team_id, []),
            )
        )

    teams.sort(
        key=lambda row: (
            -int(_number(row.get("standingPosition"), 9999)),
            _number(row.get("winningRate")),
            _number(row.get("gameWinCount")),
        ),
        reverse=True,
    )
    for index, team in enumerate(teams, start=1):
        team["rank"] = index

    fetched_at = datetime.now().isoformat(timespec="seconds")
    leagues = fetch_opgg_leagues()
    meta = {
        "source": "esports.op.gg",
        "league": context.get("league"),
        "leagues": leagues,
        "season": {
            "name": _format_opgg_season(context.get("league"), context.get("serie")),
            "serieId": context.get("serie", {}).get("id"),
            "year": context.get("serie", {}).get("year"),
            "season": context.get("serie", {}).get("season"),
        },
        "fetchedAt": fetched_at,
        "cacheFallback": False,
        "opggLeague": context.get("league"),
        "opggTournaments": context.get("tournaments", []),
        "opggTournamentOverview": context.get("tournamentOverview", []),
    }
    return {"teams": {**meta, "data": teams}, "players": {**meta, "data": players}}


def _extract_json_from_script(text: str) -> Any:
    match = re.search(r"return\s+(\[.*?\])[\s;]*}\)", text, re.DOTALL)
    if not match:
        raise ValueError("LPL season script did not expose JSON data")
    return json.loads(match.group(1))


def fetch_lpl_seasons() -> list[dict[str, Any]]:
    response = requests.get(LPL_SEASONS_URL, headers=HEADERS, timeout=25)
    response.raise_for_status()
    rows = _extract_json_from_script(response.text)
    seasons: list[dict[str, Any]] = []

    for season_group in rows:
        for key in ("domestic", "abroad"):
            for item in season_group.get(key, []) or []:
                url = item.get("url") or ""
                season_id = str(item.get("iGameId") or item.get("id") or "")
                stage_ids = str(item.get("sGameType") or "")
                if not season_id:
                    match = re.search(r"seasonId=([^&]+)", url)
                    season_id = match.group(1) if match else ""
                if not stage_ids:
                    match = re.search(r"stageIds=([^&]+)", url)
                    stage_ids = match.group(1) if match else ""
                if season_id and stage_ids:
                    seasons.append(
                        {
                            "name": item.get("gameName") or item.get("names") or "",
                            "seasonId": season_id,
                            "stageIds": stage_ids,
                            "url": url,
                            "year": season_group.get("name"),
                        }
                    )

    return seasons


def resolve_lpl_season(season_id: str | None = None, stage_ids: str | None = None) -> dict[str, Any]:
    season_id = season_id or DEFAULT_SEASON_ID
    stage_ids = stage_ids or DEFAULT_STAGE_IDS
    seasons = fetch_lpl_seasons()

    if season_id and stage_ids:
        matched = next(
            (
                season
                for season in seasons
                if str(season.get("seasonId")) == str(season_id)
                and str(season.get("stageIds")) == str(stage_ids)
            ),
            None,
        )
        return matched or {"name": f"LPL {season_id}", "seasonId": season_id, "stageIds": stage_ids}

    lpl_seasons = [season for season in seasons if "LPL" in str(season.get("name") or "")]
    if lpl_seasons:
        def season_sort_key(season: dict[str, Any]) -> tuple[int, int]:
            name = str(season.get("name") or "")
            year_match = re.search(r"(20\d{2})", name)
            year = int(year_match.group(1)) if year_match else 0
            stage_match = re.search(r"\u7b2c([一二三四五六七八九十]+)\u8d5b\u6bb5", name)
            stage_order = CHINESE_STAGE_ORDER.get(stage_match.group(1), 0) if stage_match else 0
            return year, stage_order

        return max(lpl_seasons, key=season_sort_key)
    if seasons:
        return seasons[0]
    raise ValueError("failed to fetch LPL seasons")


def fetch_lpl_stats(kind: str, season_id: str, stage_ids: str) -> list[dict[str, Any]]:
    payload = _request_json(
        f"{LPL_STATS_BASE_URL}/compound/public/{kind}",
        params={"seasonId": season_id, "stageIds": stage_ids},
    )
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("list"), list):
        return data["list"]
    if isinstance(data, list):
        return data
    raise ValueError(f"LPL {kind} stats returned unexpected data")


def _enrich_lpl_teams(teams: list[dict[str, Any]], opgg: dict[str, Any]) -> list[dict[str, Any]]:
    opgg_teams = opgg.get("teamsByAcronym", {})
    matches_by_team = opgg.get("matchesByTeam", {})
    enriched = []

    for index, team in enumerate(teams):
        row = dict(team)
        acronym = str(row.get("teamName") or "").upper()
        opgg_team = opgg_teams.get(acronym, {})
        opgg_team_id = str(opgg_team.get("id") or "")
        team_matches = matches_by_team.get(opgg_team_id, [])
        finished_matches = [match for match in team_matches if str(match.get("status") or "").lower() == "finished"]
        upcoming_matches = [
            match for match in team_matches
            if str(match.get("status") or "").lower() not in {"finished", "canceled"}
        ]
        row.update(
            {
                "rank": index + 1,
                "acronym": acronym,
                "fullName": opgg_team.get("name") or row.get("teamName"),
                "opggTeamId": opgg_team.get("id"),
                "opggLogo": _pick_logo(opgg_team),
                "matchLossCount": max(int(_number(row.get("matchCount"))) - int(_number(row.get("matchWinCount"))), 0),
                "gameLossCount": max(int(_number(row.get("gameCount"))) - int(_number(row.get("gameWinCount"))), 0),
                "matchWinningRate": (
                    _number(row.get("matchWinCount")) / _number(row.get("matchCount"), 1)
                    if _number(row.get("matchCount")) else 0
                ),
                "setWins": int(_number(row.get("gameWinCount"))),
                "setLosses": max(int(_number(row.get("gameCount"))) - int(_number(row.get("gameWinCount"))), 0),
                "nationality": opgg_team.get("nationality"),
                "foundedAt": opgg_team.get("foundedAt"),
                "website": opgg_team.get("website"),
                "twitter": opgg_team.get("twitter"),
                "finishedMatches": len(finished_matches),
                "scheduledMatches": len(upcoming_matches),
                "recentMatches": [_compact_match(match) for match in finished_matches[-5:]],
                "upcomingMatches": [_compact_match(match) for match in upcoming_matches[:5]],
                "recentMatchesAll": [_compact_match(match) for match in finished_matches[-12:]],
                "upcomingMatchesAll": [_compact_match(match) for match in upcoming_matches[:12]],
                "standings": (opgg.get("standingsByTeam", {}).get(opgg_team_id, {}) or {}).get("tournaments", []),
                "opggMatchesTotal": len(team_matches),
                "source": "lpl.qq.com + esports.op.gg",
            }
        )
        enriched.append(row)

    return enriched


def _opgg_player_lookup(players_by_team: dict[str, list[dict[str, Any]]]) -> dict[tuple[str, str], dict[str, Any]]:
    lookup: dict[tuple[str, str], dict[str, Any]] = {}
    for team_players in players_by_team.values():
        for player in team_players:
            name_key = _text_key(player.get("playerName"))
            team_key = _text_key(player.get("teamName"))
            if not name_key:
                continue
            if team_key:
                lookup[(team_key, name_key)] = player
            lookup.setdefault(("", name_key), player)
    return lookup


def _merge_lpl_player_with_opgg(row: dict[str, Any], opgg_player: dict[str, Any] | None) -> dict[str, Any]:
    if not opgg_player:
        return row

    merged = dict(row)
    merged.update(
        {
            "opggPlayerId": opgg_player.get("playerId"),
            "opggAvatar": opgg_player.get("playerAvatar"),
            "opggTeamId": opgg_player.get("teamId"),
            "opggTeamLogo": opgg_player.get("teamLogo"),
            "teamFullName": _first_present(row.get("teamFullName"), opgg_player.get("teamFullName")),
            "realName": _first_present(row.get("realName"), opgg_player.get("realName")),
            "birthday": _first_present(row.get("birthday"), opgg_player.get("birthday")),
            "nationality": _first_present(row.get("nationality"), opgg_player.get("nationality")),
            "stream": _first_present(row.get("stream"), opgg_player.get("stream")),
            "youtube": _first_present(row.get("youtube"), opgg_player.get("youtube")),
            "twitter": _first_present(row.get("twitter"), opgg_player.get("twitter")),
            "facebook": _first_present(row.get("facebook"), opgg_player.get("facebook")),
            "instagram": _first_present(row.get("instagram"), opgg_player.get("instagram")),
            "discord": _first_present(row.get("discord"), opgg_player.get("discord")),
            "opScore": _first_present(row.get("opScore"), opgg_player.get("opScore")),
            "opScoreGrade": _first_present(row.get("opScoreGrade"), opgg_player.get("opScoreGrade")),
            "opggTournamentId": opgg_player.get("tournamentId"),
            "source": "lpl.qq.com + esports.op.gg",
        }
    )
    merged["playerAvatar"] = _first_present(row.get("playerAvatar"), opgg_player.get("playerAvatar"))
    merged["teamLogo"] = _first_present(row.get("teamLogo"), opgg_player.get("teamLogo"))

    for metric in (
        "firstBloodPerGame",
        "firstTowerPerGame",
        "creepScorePerMinute",
        "wardPlacedPerGame",
        "wardKilledPerGame",
        "visionScorePerGame",
        "damageTakenPerMinute",
        "damagePerGold",
        "goldPerMinute",
    ):
        if merged.get(metric) in (None, "") and opgg_player.get(metric) not in (None, ""):
            merged[metric] = opgg_player.get(metric)

    return merged


def _lpl_hero_pool(hero_rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_player: dict[str, list[dict[str, Any]]] = {}
    for hero in hero_rows:
        player_id = str(hero.get("mostUsePlayerId") or "")
        if not player_id:
            continue
        by_player.setdefault(player_id, []).append(
            {
                "heroId": hero.get("heroId"),
                "heroName": hero.get("heroName"),
                "heroCnName": hero.get("heroCnName"),
                "heroCnTitle": hero.get("heroCnTitle"),
                "heroLogo": _first_present(hero.get("heroLogo"), "").replace("http://", "https://"),
                "heroLocation": hero.get("heroLocation"),
                "pickCount": hero.get("pickCount"),
                "pickRate": hero.get("pickRate"),
                "banCount": hero.get("banCount"),
                "banRate": hero.get("banRate"),
                "bpCount": hero.get("bpCount"),
                "bpRate": hero.get("bPRate"),
                "wins": hero.get("winningCount"),
                "winRate": hero.get("winningRate"),
                "kda": hero.get("kDA"),
                "killPerGame": hero.get("killPerGame"),
                "deathPerGame": hero.get("deathPerGame"),
                "assistPerGame": hero.get("assistPerGame"),
                "source": "lpl.qq.com",
            }
        )
    for rows in by_player.values():
        rows.sort(key=lambda item: (_number(item.get("pickCount")), _number(item.get("bpCount"))), reverse=True)
    return by_player


def _lpl_team_hero_summary(hero_rows: list[dict[str, Any]], limit: int = 18) -> list[dict[str, Any]]:
    return [
        {
            "heroId": hero.get("heroId"),
            "heroName": hero.get("heroName"),
            "heroCnName": hero.get("heroCnName"),
            "heroCnTitle": hero.get("heroCnTitle"),
            "heroLogo": _first_present(hero.get("heroLogo"), "").replace("http://", "https://"),
            "heroLocation": hero.get("heroLocation"),
            "pickCount": hero.get("pickCount"),
            "pickRate": hero.get("pickRate"),
            "banCount": hero.get("banCount"),
            "banRate": hero.get("banRate"),
            "bpCount": hero.get("bpCount"),
            "bpRate": hero.get("bPRate"),
            "wins": hero.get("winningCount"),
            "winRate": hero.get("winningRate"),
            "kda": hero.get("kDA"),
            "mostUsePlayerId": hero.get("mostUsePlayerId"),
            "mostUsePlayerName": hero.get("mostUsePlayerName"),
        }
        for hero in sorted(
            hero_rows,
            key=lambda item: (_number(item.get("bpCount")), _number(item.get("pickCount"))),
            reverse=True,
        )[:limit]
    ]


def _enrich_lpl_players(
    players: list[dict[str, Any]],
    teams: list[dict[str, Any]] | None = None,
    opgg_players_by_team: dict[str, list[dict[str, Any]]] | None = None,
    hero_rows: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    team_by_id = {str(team.get("teamId")): team for team in teams or []}
    opgg_lookup = _opgg_player_lookup(opgg_players_by_team or {})
    hero_pool = _lpl_hero_pool(hero_rows or [])
    enriched = []
    for index, player in enumerate(players):
        row = dict(player)
        team = team_by_id.get(str(row.get("teamId"))) or {}
        team_name = str(row.get("teamName") or team.get("teamName") or "").upper()
        opgg_player = opgg_lookup.get((_text_key(team_name), _text_key(row.get("playerName")))) or opgg_lookup.get(
            ("", _text_key(row.get("playerName")))
        )
        games = int(_number(row.get("boCount")) or _number(row.get("matchCount")) or _number(team.get("gameCount")))
        team_games = int(_number(team.get("gameCount")))
        team_wins = int(_number(team.get("gameWinCount")))
        team_win_rate = team_wins / team_games if team_games else 0
        wins = min(games, round(games * team_win_rate)) if games else 0
        loses = max(games - wins, 0) if games else int(_number(team.get("gameLossCount")))
        row.update(
            {
                "rank": index + 1,
                "playerLocation": _normalize_role(row.get("playerLocation")),
                "teamName": team_name or row.get("teamName"),
                "teamFullName": team.get("fullName") or row.get("teamFullName"),
                "opggTeamId": team.get("opggTeamId"),
                "opggTeamLogo": team.get("opggLogo"),
                "games": games,
                "wins": wins,
                "loses": loses,
                "winRate": wins / games if games else 0,
                "creepScorePerMinute": (
                    _number(row.get("creepScorePerGame")) / (_number(team.get("timePerGameTeam")) / 60)
                    if _number(row.get("creepScorePerGame")) and _number(team.get("timePerGameTeam"))
                    else None
                ),
                "championPool": hero_pool.get(str(row.get("playerId")), [])[:8],
                "source": "lpl.qq.com",
            }
        )
        enriched.append(_merge_lpl_player_with_opgg(row, opgg_player))
    return enriched


def _attach_lpl_team_player_rollups(teams: list[dict[str, Any]], players: list[dict[str, Any]]) -> list[dict[str, Any]]:
    players_by_team: dict[str, list[dict[str, Any]]] = {}
    for player in players:
        players_by_team.setdefault(str(player.get("teamId")), []).append(player)

    enriched = []
    for team in teams:
        row = dict(team)
        team_players = players_by_team.get(str(row.get("teamId")), [])
        if team_players:
            row["roster"] = [
                {
                    "playerId": player.get("playerId"),
                    "playerName": player.get("playerName"),
                    "playerLocation": player.get("playerLocation"),
                    "playerAvatar": player.get("playerAvatar"),
                    "kda": player.get("kda"),
                    "games": player.get("games"),
                    "winRate": player.get("winRate"),
                    "championPool": player.get("championPool", [])[:3],
                }
                for player in sorted(team_players, key=lambda item: ROLE_MAP.get(str(item.get("playerLocation")), "ZZZ"))
            ]
            row["damagePerMinuteTeam"] = round(sum(_number(player.get("damagePerMinute")) for player in team_players), 2)
            row["damageTakenPerMinuteTeam"] = round(
                sum(_number(player.get("damageTakenPerMinute")) for player in team_players), 2
            )
            row["creepScorePerGameTeam"] = round(sum(_number(player.get("creepScorePerGame")) for player in team_players), 2)
            row["visionScorePerGameTeam"] = round(sum(_number(player.get("visionScorePerGame")) for player in team_players), 2)
        enriched.append(row)
    return enriched


def _format_opgg_season(league: dict[str, Any] | None, serie: dict[str, Any] | None) -> str:
    league_name = (league or {}).get("shortName") or "OP.GG"
    year = (serie or {}).get("year") or ""
    season = (serie or {}).get("season") or ""
    return " ".join(str(item) for item in [league_name, year, season] if item).strip()


def fetch_lpl_pro_stats(season_id: str | None = None, stage_ids: str | None = None) -> dict[str, Any]:
    season = resolve_lpl_season(season_id, stage_ids)
    season_id = str(season["seasonId"])
    stage_ids = str(season["stageIds"])

    teams = fetch_lpl_stats("team", season_id, stage_ids)
    players = fetch_lpl_stats("player", season_id, stage_ids)
    heroes = fetch_lpl_stats("hero", season_id, stage_ids)
    opgg_context = fetch_opgg_league_context("LPL")
    leagues = fetch_opgg_leagues()

    fetched_at = datetime.now().isoformat(timespec="seconds")
    meta = {
        "source": "lpl.qq.com + esports.op.gg",
        "league": opgg_context.get("league"),
        "leagues": leagues,
        "season": season,
        "seasonId": season_id,
        "stageIds": stage_ids,
        "fetchedAt": fetched_at,
        "cacheFallback": False,
        "opggLeague": opgg_context.get("league"),
        "opggTournaments": opgg_context.get("tournaments", []),
    }

    enriched_teams = _enrich_lpl_teams(teams, opgg_context)
    hero_summary = _lpl_team_hero_summary(heroes)
    for team in enriched_teams:
        team["leagueHeroStats"] = hero_summary
    try:
        opgg_players_by_team, _ = _fetch_opgg_players_by_team(opgg_context)
    except Exception as exc:
        rich_logger.error(f"[ProStatsSync] OP.GG LPL player enrichment failed: {exc}")
        opgg_players_by_team = {}

    enriched_players = _enrich_lpl_players(players, enriched_teams, opgg_players_by_team, heroes)
    enriched_teams = _attach_lpl_team_player_rollups(enriched_teams, enriched_players)

    return {
        "teams": {**meta, "data": enriched_teams, "champions": hero_summary, "lplHeroStats": heroes},
        "players": {**meta, "data": enriched_players, "champions": hero_summary, "lplHeroStats": heroes},
    }


def fetch_pro_stats(
    league: str | None = None,
    season_id: str | None = None,
    stage_ids: str | None = None,
) -> dict[str, Any]:
    league_key = _league_key(league)
    if league_key == "LPL":
        return fetch_lpl_pro_stats(season_id, stage_ids)
    return fetch_opgg_pro_stats(league_key)


def sync_pro_stats(
    league: str | None = None,
    season_id: str | None = None,
    stage_ids: str | None = None,
) -> dict[str, Any]:
    league_key = _league_key(league)
    with _status_lock:
        _last_status["running"] = True

    try:
        payload = fetch_pro_stats(league=league_key, season_id=season_id, stage_ids=stage_ids)
        _write_json(_cache_path("teams", league_key), payload["teams"])
        _write_json(_cache_path("players", league_key), payload["players"])
        try:
            schedule_payload = fetch_lpl_schedule(season_id, stage_ids) if league_key == "LPL" else fetch_opgg_pro_schedule(league_key)
            _write_json(_cache_path("schedule", league_key), schedule_payload)
        except Exception as schedule_exc:
            rich_logger.error(f"[ProStatsSync] schedule sync skipped league={league_key}: {schedule_exc}")

        if league_key == DEFAULT_LEAGUE:
            _write_json(LEGACY_TEAMS_CACHE_PATH, payload["teams"])
            _write_json(LEGACY_PLAYERS_CACHE_PATH, payload["players"])
            _write_json(env.TEAM_LIST, payload["teams"])

        with _status_lock:
            _last_status.update(
                {
                    "running": False,
                    "lastSuccessAt": payload["teams"]["fetchedAt"],
                    "lastError": None,
                    "lastPayload": {
                        "league": league_key,
                        "season": payload["teams"].get("season"),
                        "seasonId": payload["teams"].get("seasonId"),
                        "stageIds": payload["teams"].get("stageIds"),
                        "teams": len(payload["teams"].get("data", [])),
                        "players": len(payload["players"].get("data", [])),
                    },
                }
            )
        _write_json(STATUS_PATH, get_pro_stats_sync_status())
        rich_logger.info(f"[ProStatsSync] synced league={league_key}")
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
            _write_json(STATUS_PATH, get_pro_stats_sync_status())
        except Exception:
            pass
        rich_logger.error(f"[ProStatsSync] sync failed league={league_key}: {exc}")
        raise


def _legacy_team_payload() -> dict[str, Any]:
    try:
        with open(env.TEAM_LIST, "r", encoding="utf-8") as file:
            payload = json.load(file)
        if isinstance(payload, dict):
            payload.setdefault("source", "lpl.qq.com")
            payload.setdefault("cacheFallback", True)
            return payload
        if isinstance(payload, list):
            return {"data": payload, "source": "lpl.qq.com", "cacheFallback": True}
    except Exception as exc:
        rich_logger.error(f"[ProStatsSync] read legacy team data failed: {exc}")
    return {"data": [], "source": "lpl.qq.com", "cacheFallback": True}


def get_cached_pro_teams(league: str | None = None, allow_sync: bool = True) -> dict[str, Any]:
    league_key = _league_key(league)
    cached = _load_json(_cache_path("teams", league_key))
    if cached:
        return cached
    if league_key == DEFAULT_LEAGUE:
        cached = _load_json(LEGACY_TEAMS_CACHE_PATH)
        if cached:
            return cached
    if allow_sync:
        try:
            return sync_pro_stats(league=league_key)["teams"]
        except Exception:
            pass
    return _legacy_team_payload() if league_key == DEFAULT_LEAGUE else {
        "data": [],
        "source": "esports.op.gg",
        "league": {"shortName": league_key},
        "cacheFallback": True,
    }


def get_cached_pro_players(league: str | None = None, allow_sync: bool = True) -> dict[str, Any]:
    league_key = _league_key(league)
    cached = _load_json(_cache_path("players", league_key))
    if cached:
        return cached
    if league_key == DEFAULT_LEAGUE:
        cached = _load_json(LEGACY_PLAYERS_CACHE_PATH)
        if cached:
            return cached
    if allow_sync:
        try:
            return sync_pro_stats(league=league_key)["players"]
        except Exception:
            pass
    return {
        "data": [],
        "source": "esports.op.gg",
        "league": {"shortName": league_key},
        "cacheFallback": True,
    }


def get_cached_opgg_team_profile(team_id: str, acronym: str = "") -> dict[str, Any]:
    return fetch_opgg_team_profile(str(team_id), acronym)


def get_cached_opgg_player_profile(player_id: str, nick_name: str = "") -> dict[str, Any]:
    return fetch_opgg_player_profile(str(player_id), nick_name)


def get_pro_stats_sync_status() -> dict[str, Any]:
    status = _load_json(STATUS_PATH) or {}
    with _status_lock:
        merged = {**status, **_last_status}
    merged["intervalSeconds"] = DEFAULT_INTERVAL_SECONDS
    return merged


def _scheduler_loop(interval_seconds: int) -> None:
    while True:
        try:
            sync_pro_stats(league=DEFAULT_LEAGUE)
        except Exception:
            pass
        time.sleep(interval_seconds)


def start_pro_stats_scheduler(interval_seconds: int = DEFAULT_INTERVAL_SECONDS) -> None:
    global _scheduler_started
    if _scheduler_started or os.getenv("PRO_STATS_SYNC_DISABLED") == "1":
        return

    _scheduler_started = True
    thread = threading.Thread(
        target=_scheduler_loop,
        args=(max(60, interval_seconds),),
        name="pro-stats-sync",
        daemon=True,
    )
    thread.start()
