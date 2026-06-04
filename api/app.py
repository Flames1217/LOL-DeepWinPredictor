import json
import os
import ssl
import threading
from contextvars import ContextVar
from functools import lru_cache
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response as FastAPIResponse, StreamingResponse

try:
    from ai_prediction import call_ai_prediction_analysis, get_ai_prediction_config, save_ai_prediction_config, stream_ai_prediction_analysis, test_ai_provider_connection
    from model_storage import resolve_model_path
except ModuleNotFoundError:
    from api.ai_prediction import call_ai_prediction_analysis, get_ai_prediction_config, save_ai_prediction_config, stream_ai_prediction_analysis, test_ai_provider_connection
    from api.model_storage import resolve_model_path
from BILSTM_Att.BILSTM_Att import BiLSTMModelWithAttention
from Data_CrawlProcess import env
from Data_CrawlProcess.champion_stats_sync import (
    get_cached_opgg_champion_detail,
    get_cached_opgg_stats,
    get_cached_opgg_region_icon,
    get_cached_opgg_role_icon,
    get_sync_status,
    start_champion_stats_scheduler,
    sync_opgg_stats,
)
from Data_CrawlProcess.team_player_stats_sync import (
    fetch_opgg_leagues,
    fetch_lpl_match_detail,
    fetch_opgg_match_detail,
    get_cached_opgg_player_profile,
    get_cached_opgg_team_profile,
    get_cached_pro_players,
    get_cached_pro_schedule,
    get_cached_pro_teams,
    get_opgg_league_icon_url,
    get_pro_stats_sync_status,
    start_pro_stats_scheduler,
    sync_pro_stats,
)
from tool_utils.log_utils import RichLogger
from tool_utils.mysql_utils import MySQLUtils

rich_logger = RichLogger()
mysql_utils = MySQLUtils()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'static', 'saved_model')
FRONTEND_OUT_DIR = os.path.join(BASE_DIR, 'frontend', 'out')
TENCENT_RANK_URL = 'https://x1-6833.native.qq.com/x1/6833/1061021&3af49f'
TENCENT_CN_LANES = [
    ('top', 'TOP'),
    ('jungle', 'JUN'),
    ('mid', 'MID'),
    ('bottom', 'ADC'),
    ('support', 'SUP'),
]
TENCENT_CN_LANE_BY_ROLE = {
    'ALL': 'all',
    'TOP': 'top',
    'JUN': 'jungle',
    'MID': 'mid',
    'ADC': 'bottom',
    'SUP': 'support',
}
TENCENT_CN_POSITION_BY_LANE = {lane: position for lane, position in TENCENT_CN_LANES}
TENCENT_RANK_CACHE = {}
TENCENT_RANK_CACHE_TTL = 60 * 10
DDRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
DDRAGON_CDN = 'https://ddragon.leagueoflegends.com/cdn'
DDRAGON_IMAGE_CDN = 'https://ddragon.leagueoflegends.com/cdn/img'
CDRAGON_DATA_CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'
HTTPS_CONTEXT = ssl._create_unverified_context()
RUNE_ICON_CACHE = None
RUNE_ICON_LOCK = threading.Lock()
PREDICTION_VECTOR_FIELDS = [
    ('left_team', 'teamAid'),
    ('right_team', 'teamBid'),
    ('left_team', 'A1playerLocation'),
    ('left_team', 'A1heroId'),
    ('left_team', 'A1heroWinRate'),
    ('left_team', 'A2playerLocation'),
    ('left_team', 'A2heroId'),
    ('left_team', 'A2heroWinRate'),
    ('left_team', 'A3playerLocation'),
    ('left_team', 'A3heroId'),
    ('left_team', 'A3heroWinRate'),
    ('left_team', 'A4playerLocation'),
    ('left_team', 'A4heroId'),
    ('left_team', 'A4heroWinRate'),
    ('left_team', 'A5playerLocation'),
    ('left_team', 'A5heroId'),
    ('left_team', 'A5heroWinRate'),
    ('right_team', 'B1playerLocation'),
    ('right_team', 'B1heroId'),
    ('right_team', 'B1heroWinRate'),
    ('right_team', 'B2playerLocation'),
    ('right_team', 'B2heroId'),
    ('right_team', 'B2heroWinRate'),
    ('right_team', 'B3playerLocation'),
    ('right_team', 'B3heroId'),
    ('right_team', 'B3heroWinRate'),
    ('right_team', 'B4playerLocation'),
    ('right_team', 'B4heroId'),
    ('right_team', 'B4heroWinRate'),
    ('right_team', 'B5playerLocation'),
    ('right_team', 'B5heroId'),
    ('right_team', 'B5heroWinRate'),
]

_current_request = ContextVar('current_fastapi_request', default=None)
_current_json = ContextVar('current_fastapi_json', default={})


class DeepWinAPI(FastAPI):
    """FastAPI app with a Flask-style route decorator during migration."""

    def route(self, path, methods=None, **kwargs):
        return self.api_route(path, methods=methods or ['GET'], **kwargs)


class _RequestArgs:
    def __init__(self, params):
        self._params = params

    def get(self, key, default=None):
        value = self._params.get(key)
        return default if value is None else value


class _RequestProxy:
    @property
    def args(self):
        current = _current_request.get()
        return _RequestArgs(current.query_params if current else {})

    @property
    def json(self):
        return _current_json.get() or {}

    @property
    def remote_addr(self):
        current = _current_request.get()
        if current and current.client:
            return current.client.host
        return ''


def _json_default(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return str(value)


def _jsonable(value):
    return json.loads(json.dumps(value, default=_json_default, ensure_ascii=False))


def jsonify(data):
    return JSONResponse(content=_jsonable(data))


def json_response(data, status_code=200):
    return JSONResponse(content=_jsonable(data), status_code=status_code)


def Response(content='', mimetype=None, status=200, headers=None):
    return FastAPIResponse(content=content, media_type=mimetype, status_code=status, headers=headers)


def redirect(url, code=302):
    return RedirectResponse(url=url, status_code=code)


def send_from_directory(directory, filename, mimetype=None):
    return FileResponse(os.path.join(directory, filename), media_type=mimetype)


def render_template(filename):
    return FastAPIResponse(
        content=(
            '<!doctype html><meta charset="utf-8">'
            '<title>LOL-DeepWinPredictor</title>'
            '<main style="font-family:system-ui;padding:32px">'
            '<h1>LOL-DeepWinPredictor API is running</h1>'
            '<p>Frontend build not found. Run <code>cd frontend && npm run build</code> to generate <code>frontend/out</code>.</p>'
            '</main>'
        ),
        media_type='text/html',
    )


request = _RequestProxy()
app = DeepWinAPI(title='LOL-DeepWinPredictor API', version='2026.05.30')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def request_context_middleware(req: FastAPIRequest, call_next):
    request_token = _current_request.set(req)
    json_token = _current_json.set({})
    try:
        content_type = req.headers.get('content-type', '')
        if 'application/json' in content_type:
            body = await req.body()
            if body:
                try:
                    _current_json.set(json.loads(body.decode('utf-8')))
                except json.JSONDecodeError:
                    _current_json.set({})
        return await call_next(req)
    finally:
        _current_json.reset(json_token)
        _current_request.reset(request_token)

MODEL_LOCAL_PATH = resolve_model_path(os.path.join(MODEL_DIR, 'BILSTM_Att.pt'), rich_logger)
try:
    if not os.path.exists(MODEL_LOCAL_PATH):
        raise FileNotFoundError(f"model file not found: {MODEL_LOCAL_PATH}")
    model = BiLSTMModelWithAttention(input_size=32, hidden_size=1024, num_layers=2, output_size=1)
    model.load_state_dict(torch.load(MODEL_LOCAL_PATH, map_location=torch.device('cpu'), weights_only=True))
    model.eval()
except Exception as e:
    rich_logger.error(f"model load failed: {e}")
    model = None


@app.route('/riot.txt')
def serve_riot_txt():
    return send_from_directory(os.path.abspath(os.path.dirname(__file__) + '/../'), 'riot.txt', mimetype='text/plain')


@app.route('/')
def index():
    ip = request.remote_addr
    mysql_utils.record_visit(ip)
    if os.path.exists(os.path.join(FRONTEND_OUT_DIR, 'index.html')):
        return send_from_directory(FRONTEND_OUT_DIR, 'index.html')
    return render_template('index.html')


@app.route('/site_stats', methods=['GET'])
def site_stats():
    """Return site visit counters."""
    total, user = mysql_utils.get_site_stats()
    return jsonify({
        "visit_count": total,
        "visitor_count": user
    })


@app.route('/query_win_rate', methods=['GET'])
def query_win_rate():
    """Fetch OP.GG champion win-rate data."""
    region = request.args.get('region', 'global')
    tier = request.args.get('tier', 'all')
    patch = request.args.get('patch') or request.args.get('version') or None
    game_type = request.args.get('game_type') or request.args.get('type') or 'SOLORANKED'
    payload = get_cached_opgg_stats(
        region=region,
        tier=tier,
        patch=patch,
        allow_sync=True,
        game_type=game_type,
    )
    return jsonify(payload)


@app.route('/query_champion_detail', methods=['GET'])
def query_champion_detail():
    champion = request.args.get('champion') or request.args.get('key')
    if not champion:
        return json_response({'error': 'champion is required'}, status_code=400)

    position = request.args.get('position') or request.args.get('role') or 'adc'
    region = request.args.get('region', 'global')
    tier = request.args.get('tier', 'all')
    patch = request.args.get('patch') or request.args.get('version') or None
    game_type = request.args.get('game_type') or request.args.get('type') or 'ranked'
    target_champion = request.args.get('target_champion') or request.args.get('target') or None
    payload = get_cached_opgg_champion_detail(
        champion=champion,
        position=position,
        region=region,
        tier=tier,
        patch=patch,
        allow_sync=True,
        game_type=game_type,
        target_champion=target_champion,
    )
    return jsonify(payload)


@app.route('/champion_stats_sync/status', methods=['GET'])
def champion_stats_sync_status():
    return jsonify(get_sync_status())


@app.route('/champion_stats_sync/run', methods=['POST'])
def champion_stats_sync_run():
    region = request.args.get('region', 'global')
    tier = request.args.get('tier', 'all')
    patch = request.args.get('patch') or request.args.get('version') or None
    game_type = request.args.get('game_type') or request.args.get('type') or 'SOLORANKED'
    try:
        payload = sync_opgg_stats(region=region, tier=tier, patch=patch, game_type=game_type)
        return jsonify({
            'ok': True,
            'region': payload.get('region'),
            'tier': payload.get('tier'),
            'patch': payload.get('patch'),
            'gameType': payload.get('gameType'),
            'rows': len(payload.get('data', [])),
            'fetchedAt': payload.get('fetchedAt'),
        })
    except Exception as exc:
        return json_response({'ok': False, 'error': str(exc)}, status_code=502)


@app.route('/opgg_region_icon/{region}.svg', methods=['GET'])
def opgg_region_icon(region):
    try:
        svg = get_cached_opgg_region_icon(region)
    except Exception:
        svg = get_cached_opgg_region_icon('global')
    return Response(svg, mimetype='image/svg+xml')


@app.route('/opgg_role_icon/{role}.svg', methods=['GET'])
def opgg_role_icon(role):
    try:
        svg = get_cached_opgg_role_icon(role)
    except Exception:
        svg = get_cached_opgg_role_icon('TOP')
    return Response(svg, mimetype='image/svg+xml')


@app.route('/opgg_league_icon/{league}', methods=['GET'])
def opgg_league_icon(league):
    icon_url = get_opgg_league_icon_url(league)
    if not icon_url:
        return Response('', status=404)
    request_headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    }
    with urlopen(Request(icon_url, headers=request_headers), timeout=15) as response:
        content_type = response.headers.get('Content-Type') or 'image/png'
        body = response.read()
    return Response(body, mimetype=content_type, headers={'Cache-Control': 'public, max-age=86400'})


@app.route('/opgg_esports_favicon.ico', methods=['GET'])
def opgg_esports_favicon():
    request_headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    }
    with urlopen(Request('https://esports.op.gg/favicon.ico', headers=request_headers), timeout=15) as response:
        content_type = response.headers.get('Content-Type') or 'image/x-icon'
        body = response.read()
    return Response(body, mimetype=content_type, headers={'Cache-Control': 'public, max-age=86400'})


def _recent_rank_dates(days=7):
    today = datetime.now()
    for offset in range(days):
        yield (today - timedelta(days=offset)).strftime('%Y%m%d')


def _float_or_zero(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _prediction_tensor(payload):
    if model is None:
        raise RuntimeError('prediction model is not loaded')

    vector = [
        _float_or_zero(payload[side][field])
        for side, field in PREDICTION_VECTOR_FIELDS
    ]
    return torch.Tensor(np.array([vector], dtype=float)).reshape(1, 1, -1)


def _predict_rate(payload):
    with torch.no_grad():
        return float(model(_prediction_tensor(payload)).item())


@lru_cache(maxsize=1)
def _ddragon_version():
    try:
        req = Request(DDRAGON_VERSIONS_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=10, context=HTTPS_CONTEXT) as response:
            versions = json.loads(response.read().decode('utf-8'))
        return versions[0]
    except Exception:
        return '16.10.1'


@lru_cache(maxsize=8)
def _ddragon_json(kind):
    version = _ddragon_version()
    url = f'{DDRAGON_CDN}/{version}/data/zh_CN/{kind}.json'
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=15, context=HTTPS_CONTEXT) as response:
        return json.loads(response.read().decode('utf-8'))


@lru_cache(maxsize=2)
def _cdragon_json(filename):
    url = f'{CDRAGON_DATA_CDN}/v1/{filename}.json'
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=15, context=HTTPS_CONTEXT) as response:
        return json.loads(response.read().decode('utf-8'))


@lru_cache(maxsize=512)
def _fetch_image(url):
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    })
    with urlopen(req, timeout=15, context=HTTPS_CONTEXT) as response:
        return response.headers.get('Content-Type') or 'image/png', response.read()


def _image_response(url):
    content_type, body = _fetch_image(url)
    return Response(body, mimetype=content_type, headers={'Cache-Control': 'public, max-age=86400'})


def _rune_icon_map():
    global RUNE_ICON_CACHE
    if RUNE_ICON_CACHE is not None:
        return RUNE_ICON_CACHE
    with RUNE_ICON_LOCK:
        if RUNE_ICON_CACHE is not None:
            return RUNE_ICON_CACHE
        icon_map = {}
        for perk in _cdragon_json('perks'):
            if perk.get('id') and perk.get('iconPath'):
                path = str(perk.get('iconPath')).replace('/lol-game-data/assets', '').lower()
                icon_map[str(perk.get('id'))] = f'{CDRAGON_DATA_CDN}{path}'
        RUNE_ICON_CACHE = icon_map
    return RUNE_ICON_CACHE


def _rune_icon_path(rune_id):
    rune_id_text = str(rune_id)
    cdragon_icon = _rune_icon_map().get(rune_id_text)
    if cdragon_icon:
        return cdragon_icon
    for perk in _cdragon_json('perks'):
        if str(perk.get('id')) == rune_id_text and perk.get('iconPath'):
            path = str(perk.get('iconPath')).replace('/lol-game-data/assets', '').lower()
            return f'{CDRAGON_DATA_CDN}{path}'
    return None


def _summoner_spell_image(identifier):
    identifier_text = str(identifier or '')
    data = (_ddragon_json('summoner').get('data') or {})
    for spell in data.values():
        if identifier_text in {
            str(spell.get('key')),
            str(spell.get('id')),
            str((spell.get('image') or {}).get('full')),
        }:
            return (spell.get('image') or {}).get('full')
    return None


@app.route('/lol_champion_icon/{identifier}.png', methods=['GET'])
def lol_champion_icon(identifier):
    if str(identifier).isdigit():
        return redirect(f'{CDRAGON_DATA_CDN}/v1/champion-icons/{identifier}.png', code=302)
    return redirect(f'https://game.gtimg.cn/images/lol/act/img/champion/{identifier}.png', code=302)


@app.route('/lol_spell_icon/{identifier}.png', methods=['GET'])
def lol_spell_icon(identifier):
    if str(identifier).startswith('Summoner_'):
        return redirect(f'https://game.gtimg.cn/images/lol/act/img/spell/{identifier}.png', code=302)
    image = _summoner_spell_image(identifier)
    if image:
        return redirect(f'{DDRAGON_CDN}/{_ddragon_version()}/img/spell/{image}', code=302)
    return redirect(f'https://game.gtimg.cn/images/lol/act/img/spell/{identifier}.png', code=302)


@app.route('/lol_rune_icon/{rune_id}.png', methods=['GET'])
def lol_rune_icon(rune_id):
    icon_path = _rune_icon_path(rune_id)
    if not icon_path:
        return Response('', status=404)
    if str(icon_path).startswith('http'):
        return redirect(icon_path, code=302)
    return redirect(f'{DDRAGON_IMAGE_CDN}/{icon_path}', code=302)


def _parse_tencent_counters(value, limit=3):
    text = str(value or '').strip()
    if not text or text == '[]':
        return []
    text = text.strip('[]')
    counters = []
    for item in text.split('&'):
        if not item:
            continue
        champion_id, _, win_rate = item.partition(',')
        champion_id = champion_id.strip()
        if not champion_id:
            continue
        counters.append({
            'champion_id': champion_id,
            'counterWinRate': round(_float_or_zero(win_rate) * 100, 4),
        })
        if len(counters) >= limit:
            break
    return counters


def _fetch_tencent_rank_lane_for_date(lane, position_name, tier, queue, stat_date):
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://101.qq.com/',
    }
    params = {
        'championid': '666',
        'lane': lane,
        'ijob': 'all',
        'dtstatdate': stat_date,
        'gamequeueconfigid': queue,
        'tier': tier,
    }
    url = f'{TENCENT_RANK_URL}?{urlencode(params)}'
    req = Request(url, headers=headers)
    with urlopen(req, timeout=8) as response:
        payload = json.loads(response.read().decode('utf-8'))

    result = payload.get('data', {}).get('result')
    if isinstance(result, str):
        result = json.loads(result)
    details = result.get('championdetails') if isinstance(result, dict) else ''
    if not details:
        return []

    rows = []
    for detail in details.split('#'):
        parts = detail.split('_')
        if len(parts) < 6:
            continue

        champion_id = parts[1]
        rows.append({
            'champion_id': champion_id,
            'positionName': position_name,
            'positionRank': int(_float_or_zero(parts[0])),
            'positionTier': int(_float_or_zero(parts[2])),
            'positionWinRate': round(_float_or_zero(parts[3]) * 100, 4),
            'positionBanRate': round(_float_or_zero(parts[4]) * 100, 4),
            'positionPickRate': round(_float_or_zero(parts[5]) * 100, 4),
            'positionRoleRate': 0,
            'play': 0,
            'positionCounters': _parse_tencent_counters(parts[7] if len(parts) > 7 else ''),
            'positionRankDelta': int(_float_or_zero(parts[8])) if len(parts) > 8 else None,
            'source': '101.qq.com',
            'updateDate': stat_date,
        })
    return rows


def _add_tencent_rank_delta(rows, lane, position_name, tier, queue, current_date):
    if not rows or not current_date:
        return

    previous_rows = []
    for stat_date in _recent_rank_dates(10):
        if stat_date >= current_date:
            continue
        try:
            previous_rows = _fetch_tencent_rank_lane_for_date(lane, position_name, tier, queue, stat_date)
        except Exception:
            previous_rows = []
        if previous_rows:
            break

    previous_rank_by_champion = {
        str(row.get('champion_id')): int(_float_or_zero(row.get('positionRank')))
        for row in previous_rows
    }

    for row in rows:
        if row.get('positionRankDelta') is not None:
            continue

        current_rank = int(_float_or_zero(row.get('positionRank')))
        previous_rank = previous_rank_by_champion.get(str(row.get('champion_id')))
        if previous_rank:
            row['positionRankPrev'] = previous_rank
            row['positionRankDelta'] = previous_rank - current_rank
        else:
            row['positionRankPrev'] = None
            row['positionRankDelta'] = None


def _fetch_tencent_rank_lane(lane, position_name, tier, queue, include_delta=True):
    last_error = None

    for stat_date in _recent_rank_dates():
        try:
            rows = _fetch_tencent_rank_lane_for_date(lane, position_name, tier, queue, stat_date)
            if not rows:
                continue
            if include_delta:
                _add_tencent_rank_delta(rows, lane, position_name, tier, queue, stat_date)
            return rows, stat_date, None
        except Exception as exc:
            last_error = str(exc)

    return [], None, last_error


def _infer_tencent_all_positions(tier, queue):
    best_positions = {}
    with ThreadPoolExecutor(max_workers=len(TENCENT_CN_LANES)) as executor:
        futures = {
            executor.submit(_fetch_tencent_rank_lane, lane, position_name, tier, queue, False): position_name
            for lane, position_name in TENCENT_CN_LANES
        }
        for future in as_completed(futures):
            position_name = futures[future]
            lane_rows, _, _ = future.result()
            for row in lane_rows:
                champion_id = str(row.get('champion_id'))
                pick_rate = _float_or_zero(row.get('positionPickRate'))
                current = best_positions.get(champion_id)
                if not current or pick_rate > current['pick_rate']:
                    best_positions[champion_id] = {
                        'position': position_name,
                        'pick_rate': pick_rate,
                    }
    return {champion_id: item['position'] for champion_id, item in best_positions.items()}


@app.route('/query_cn_win_rate', methods=['GET'])
def query_cn_win_rate():
    """Fetch 101.qq.com champion ranking data."""
    tier = request.args.get('tier', '999')
    queue = request.args.get('queue', '420')
    lane = request.args.get('lane', 'all')
    if lane in TENCENT_CN_LANE_BY_ROLE:
        lane = TENCENT_CN_LANE_BY_ROLE[lane]
    if lane not in {'all', *TENCENT_CN_POSITION_BY_LANE.keys()}:
        lane = 'all'

    cache_key = f'{tier}:{queue}:{lane}'
    now = time.time()
    cached = TENCENT_RANK_CACHE.get(cache_key)
    if cached and now - cached['cached_at'] < TENCENT_RANK_CACHE_TTL:
        return jsonify(cached['payload'])

    rows = []
    update_dates = []
    errors = []

    if lane == 'all':
        rows, update_date, error = _fetch_tencent_rank_lane('all', 'ALL', tier, queue)
        if update_date:
            update_dates.append(update_date)
        if error:
            errors.append(f'ALL: {error}')
        if rows:
            best_positions = _infer_tencent_all_positions(tier, queue)
            for row in rows:
                row['positionName'] = best_positions.get(str(row.get('champion_id')), 'ADC')
                row['allPositionRank'] = True
    else:
        position_name = TENCENT_CN_POSITION_BY_LANE[lane]
        rows, update_date, error = _fetch_tencent_rank_lane(lane, position_name, tier, queue)
        if update_date:
            update_dates.append(update_date)
        if error:
            errors.append(f'{position_name}: {error}')

    latest_patch = None
    try:
        opgg_meta = get_cached_opgg_stats(region='global', tier='all', patch=None, allow_sync=True)
        latest_patch = opgg_meta.get('patch') or ((opgg_meta.get('versions') or [None])[0])
    except Exception:
        latest_patch = None

    payload = {
        'data': rows,
        'source': '101.qq.com',
        'tier': tier,
        'queue': queue,
        'lane': lane,
        'patch': latest_patch,
        'versions': [latest_patch] if latest_patch else [],
        'updateDate': max(update_dates) if update_dates else None,
    }
    if errors and not rows:
        payload['error'] = '; '.join(errors)

    TENCENT_RANK_CACHE[cache_key] = {
        'cached_at': now,
        'payload': payload,
    }
    return jsonify(payload)


@app.route('/query_team_stats', methods=['GET'])
def query_team_stats():
    league = request.args.get('league') or request.args.get('region') or None
    return jsonify(get_cached_pro_teams(league=league, allow_sync=True))


@app.route('/query_player', methods=['GET'])
def query_player():
    league = request.args.get('league') or request.args.get('region') or None
    payload = get_cached_pro_players(league=league, allow_sync=True)
    if request.args.get('raw') == '1':
        return jsonify(payload)
    return jsonify(payload.get('data', []))


@app.route('/query_team_detail', methods=['GET'])
def query_team_detail():
    team_id = request.args.get('team_id') or request.args.get('id')
    if not team_id:
        return json_response({'error': 'team_id is required'}, status_code=400)
    acronym = request.args.get('acronym') or request.args.get('team') or ''
    return jsonify(get_cached_opgg_team_profile(team_id, acronym))


@app.route('/query_player_detail', methods=['GET'])
def query_player_detail():
    player_id = request.args.get('player_id') or request.args.get('id')
    if not player_id:
        return json_response({'error': 'player_id is required'}, status_code=400)
    nick_name = request.args.get('nick_name') or request.args.get('name') or ''
    return jsonify(get_cached_opgg_player_profile(player_id, nick_name))


@app.route('/query_pro_leagues', methods=['GET'])
def query_pro_leagues():
    return jsonify({
        'data': fetch_opgg_leagues(),
        'source': 'OP.GG Esports',
    })


@app.route('/query_pro_schedule', methods=['GET'])
def query_pro_schedule():
    league = request.args.get('league') or request.args.get('region') or None
    refresh = request.args.get('refresh') in {'1', 'true', 'yes'}
    return jsonify(get_cached_pro_schedule(league=league, allow_sync=refresh))


@app.route('/query_pro_match_detail', methods=['GET'])
def query_pro_match_detail():
    match_id = request.args.get('match_id') or request.args.get('id')
    league = (request.args.get('league') or '').upper()
    if not match_id:
        return json_response({'error': 'match_id is required'}, status_code=400)
    if league == 'LPL' or request.args.get('source') == 'lpl':
        return jsonify(fetch_lpl_match_detail(str(match_id)))
    slug = request.args.get('slug') or request.args.get('name') or 'detail'
    return jsonify(fetch_opgg_match_detail(str(match_id), slug))


def _find_pro_team(rows, side):
    side_id = str(side.get('id') or side.get('opggTeamId') or '')
    side_acronym = str(side.get('acronym') or '').upper()
    for row in rows:
        ids = {str(row.get('teamId') or ''), str(row.get('opggTeamId') or '')}
        acronyms = {str(row.get('teamName') or '').upper(), str(row.get('acronym') or '').upper()}
        if side_id and side_id in ids:
            return row
        if side_acronym and side_acronym in acronyms:
            return row
    return None


def _rate01(value, default=0.5):
    numeric = _float_or_zero(value)
    if numeric <= 0:
        return default
    return numeric / 100 if numeric > 1 else numeric


def _build_match_side_payload(team, prefix):
    role_order = ['TOP', 'JUN', 'MID', 'ADC', 'SUP']
    role_index = {'TOP': 0, 'JUN': 1, 'MID': 2, 'ADC': 3, 'SUP': 4}
    roster = team.get('roster') or [] if team else []
    by_role = {str(player.get('playerLocation') or '').upper(): player for player in roster}
    payload = {f'team{prefix}id': int(_float_or_zero(team.get('teamId') if team else 0))}
    for index, role in enumerate(role_order, start=1):
        player = by_role.get(role) or {}
        champion = ((player.get('championPool') or []) + [{}])[0]
        payload[f'{prefix}{index}playerLocation'] = role_index[role]
        payload[f'{prefix}{index}heroId'] = int(_float_or_zero(champion.get('heroId')))
        payload[f'{prefix}{index}heroWinRate'] = _rate01(champion.get('winRate'), 0.5)
    return payload


def _build_game_side_payload(team_info, prefix):
    role_order = ['TOP', 'JUN', 'MID', 'BOT', 'SUP']
    role_index = {'TOP': 0, 'JUN': 1, 'MID': 2, 'BOT': 3, 'ADC': 3, 'SUP': 4}
    players = team_info.get('playerInfos') or []
    by_role = {str(player.get('playerLocation') or player.get('role') or '').upper(): player for player in players}
    payload = {f'team{prefix}id': int(_float_or_zero(team_info.get('teamId')))}
    for index, role in enumerate(role_order, start=1):
        player = by_role.get(role) or {}
        payload[f'{prefix}{index}playerLocation'] = role_index[role]
        payload[f'{prefix}{index}heroId'] = int(_float_or_zero(player.get('heroId')))
        payload[f'{prefix}{index}heroWinRate'] = 0.5
    return payload


def _game_team_strength(team_info):
    if not team_info:
        return 0.0
    kills = _float_or_zero(team_info.get('kills')) * 0.035
    gold = _float_or_zero(team_info.get('golds')) / 50000
    objectives = (
        _float_or_zero(team_info.get('turretAmount')) * 0.05
        + _float_or_zero(team_info.get('dragonAmount')) * 0.08
        + _float_or_zero(team_info.get('baronAmount')) * 0.16
        + _float_or_zero(team_info.get('riftHeraldAmount')) * 0.05
        + _float_or_zero(team_info.get('voidGrubAmount')) * 0.025
    )
    return kills + gold + objectives


def _team_strength(team):
    if not team:
        return 0.0
    win = _rate01(team.get('winningRate'), 0.5)
    match_win = _rate01(team.get('matchWinningRate'), win)
    rank = _float_or_zero(team.get('rank'), 10)
    kda = (
        (_float_or_zero(team.get('killPerGameTeam')) + _float_or_zero(team.get('assistPerGameTeam')))
        / max(_float_or_zero(team.get('deathPerGameTeam'), 1), 1)
    )
    economy = _float_or_zero(team.get('goldPerGameTeam')) / 100000
    damage = _float_or_zero(team.get('damagePerMinuteTeam')) / 10000
    return win * 3 + match_win * 2 + kda * 0.18 + economy + damage - rank * 0.025


def _team_payload_strength(team):
    if not team:
        return 0.0
    wins = _float_or_zero(team.get('teamWinCount') or team.get('win') or team.get('wins'))
    losses = _float_or_zero(team.get('teamLossCount') or team.get('loss') or team.get('losses'))
    games = wins + losses
    win_rate = _rate01(team.get('winningRate') or team.get('teamWinRate') or team.get('winRate'), wins / games if games else 0.5)
    kda = _float_or_zero(team.get('teamKDA') or team.get('kda'), 0.0)
    avg_kills = _float_or_zero(team.get('killPerGameTeam') or team.get('avgKills'), 0.0)
    avg_deaths = _float_or_zero(team.get('deathPerGameTeam') or team.get('avgDeaths'), 0.0)
    avg_assists = _float_or_zero(team.get('assistPerGameTeam') or team.get('avgAssists'), 0.0)
    if not kda:
        kda = (avg_kills + avg_assists) / max(avg_deaths, 1.0) if avg_deaths else 3.0
    rank = _float_or_zero(team.get('teamRank') or team.get('rank'), 10)
    return win_rate * 3.2 + kda * 0.12 + avg_kills * 0.015 - rank * 0.025


def _average_hero_rate(side_payload, prefix):
    rates = [
        _rate01(side_payload.get(f'{prefix}{index}heroWinRate'), 0.5)
        for index in range(1, 6)
    ]
    return sum(rates) / len(rates) if rates else 0.5


def _safe_sigmoid(value):
    clipped = max(-8.0, min(8.0, float(value)))
    return float(1 / (1 + np.exp(-clipped)))


def _prediction_level(rate):
    edge = abs(rate - 0.5)
    if edge >= 0.18:
        return 'high'
    if edge >= 0.08:
        return 'medium'
    return 'low'


def _calibrated_lineup_prediction(data):
    try:
        model_rate = _predict_rate(data)
    except Exception as exc:
        rich_logger.error(f"model prediction fallback: {exc}")
        model_rate = 0.5

    left_payload = data.get('left_team') or {}
    right_payload = data.get('right_team') or {}
    left_team = left_payload
    right_team = right_payload
    team_delta = _team_payload_strength(left_team) - _team_payload_strength(right_team)
    hero_delta = (_average_hero_rate(left_payload, 'A') - _average_hero_rate(right_payload, 'B')) * 4.0
    prior_rate = _safe_sigmoid(team_delta + hero_delta)
    calibrated_rate = max(0.05, min(0.95, model_rate * 0.55 + prior_rate * 0.45))
    winner_side_name = 'blue side' if calibrated_rate >= 0.5 else 'red side'
    winner_team = left_team if calibrated_rate >= 0.5 else right_team
    result = {
        'A_win': calibrated_rate * 100,
        'B_win': (1 - calibrated_rate) * 100,
        'winning_team': {
            'name': winner_team.get('teamName') or winner_team.get('acronym') or winner_side_name,
            'logo': winner_team.get('teamLogo', '') if winner_team else ''
        },
        'method': 'bilstm_calibrated_with_team_and_draft_prior',
        'modelRate': float(model_rate),
        'priorRate': float(prior_rate),
        'calibratedRate': float(calibrated_rate),
        'confidence': _prediction_level(calibrated_rate),
        'calibration': {
            'modelWeight': 0.55,
            'priorWeight': 0.45,
            'minWinRate': 0.05,
            'maxWinRate': 0.95,
        },
        'explanation': '已将本地 BiLSTM 输出与队伍强度、英雄分路胜率先验混合校准，避免过拟合模型直接给出极端胜率。',
    }
    return result


def _predict_game_from_detail(game):
    teams = game.get('teamInfos') or []
    if len(teams) < 2:
        raise ValueError('game detail does not contain both teams')
    blue_team = next((team for team in teams if str(team.get('teamSide') or '').lower() == 'blue'), teams[0])
    red_team = next((team for team in teams if str(team.get('teamSide') or '').lower() == 'red'), teams[1])
    data = {
        'left_team': _build_game_side_payload(blue_team, 'A'),
        'right_team': _build_game_side_payload(red_team, 'B'),
    }
    result = _calibrated_lineup_prediction(data)
    live_delta = _game_team_strength(blue_team) - _game_team_strength(red_team)
    if _float_or_zero(game.get('gameTime')) > 0:
        live_rate = _safe_sigmoid((result['calibratedRate'] - 0.5) * 2 + live_delta)
        result['liveAdjustedRate'] = live_rate
        result['liveAdjustedAWin'] = live_rate * 100
        result['liveAdjustedBWin'] = (1 - live_rate) * 100
    winner_id = str(game.get('matchWin') or game.get('gameWin') or '')
    actual_blue_win = winner_id and winner_id == str(blue_team.get('teamId'))
    result['game'] = {
        'bo': game.get('bo'),
        'gameTime': game.get('gameTime'),
        'status': game.get('matchStatus'),
        'blueTeamId': blue_team.get('teamId'),
        'redTeamId': red_team.get('teamId'),
        'winnerTeamId': winner_id or None,
        'blueKills': blue_team.get('kills'),
        'redKills': red_team.get('kills'),
    }
    if winner_id:
        result['backtest'] = {
            'actualBlueWin': actual_blue_win,
            'draftHit': (result['A_win'] >= result['B_win']) == actual_blue_win,
            'liveAdjustedHit': ((result.get('liveAdjustedAWin') or result['A_win']) >= (result.get('liveAdjustedBWin') or result['B_win'])) == actual_blue_win,
        }
    result['method'] = 'single_game_draft_bp_with_optional_live_adjustment'
    return result


def _compact_prediction_team(team):
    return {
        'id': team.get('teamId') or team.get('opggTeamId'),
        'name': team.get('fullName') or team.get('teamFullName') or team.get('teamName'),
        'acronym': team.get('teamName') or team.get('acronym'),
        'logo': team.get('opggLogo') or team.get('teamLogo'),
        'winRate': team.get('winningRate'),
        'matchWinRate': team.get('matchWinningRate'),
        'rank': team.get('rank'),
    }


@app.route('/predict_pro_match', methods=['POST'])
def predict_pro_match():
    data = request.json or {}
    league = data.get('league') or data.get('leagueKey') or 'LPL'
    home_side = data.get('homeTeam') or {}
    away_side = data.get('awayTeam') or {}
    teams_payload = get_cached_pro_teams(league=league, allow_sync=True)
    rows = teams_payload.get('data', [])
    home_team = _find_pro_team(rows, home_side)
    away_team = _find_pro_team(rows, away_side)
    if not home_team or not away_team:
        return json_response({'error': 'team not found for prediction'}, status_code=404)

    try:
        model_rate = _predict_rate({
            'left_team': _build_match_side_payload(home_team, 'A'),
            'right_team': _build_match_side_payload(away_team, 'B'),
        })
    except Exception:
        model_rate = 0.5

    strength_delta = _team_strength(home_team) - _team_strength(away_team)
    prior_rate = 1 / (1 + np.exp(-strength_delta))
    home_rate = max(0.05, min(0.95, model_rate * 0.55 + prior_rate * 0.45))
    result = {
        'A_win': home_rate * 100,
        'B_win': (1 - home_rate) * 100,
        'homeTeam': _compact_prediction_team(home_team),
        'awayTeam': _compact_prediction_team(away_team),
        'method': 'bilstm_roster_champion_pool + team_strength_prior',
        'modelRate': model_rate,
        'priorRate': float(prior_rate),
        'calibratedRate': float(home_rate),
        'confidence': _prediction_level(home_rate),
    }
    if data.get('includeAi'):
        result['aiAnalysis'] = call_ai_prediction_analysis({
            'mode': 'pro_match',
            'league': league,
            'homeTeam': result['homeTeam'],
            'awayTeam': result['awayTeam'],
            'result': result,
        })
    return jsonify(result)


@app.route('/predict_pro_game', methods=['POST'])
def predict_pro_game():
    data = request.json or {}
    game = data.get('game') or {}
    if not game:
        match_id = data.get('matchId') or data.get('match_id')
        game_index = int(_float_or_zero(data.get('gameIndex'), 0))
        if not match_id:
            return json_response({'error': 'game or matchId is required'}, status_code=400)
        detail = fetch_lpl_match_detail(str(match_id))
        games = detail.get('games') or []
        if game_index < 0 or game_index >= len(games):
            return json_response({'error': 'gameIndex out of range'}, status_code=400)
        game = games[game_index]
    try:
        result = _predict_game_from_detail(game)
        if data.get('includeAi'):
            result['aiAnalysis'] = call_ai_prediction_analysis({
                'mode': 'single_game',
                'game': result.get('game'),
                'result': result,
            })
        return jsonify(result)
    except Exception as exc:
        rich_logger.error(f"single game prediction failed: {exc}")
        return json_response({'error': str(exc)}, status_code=400)


@app.route('/pro_stats_sync/status', methods=['GET'])
def pro_stats_sync_status():
    return jsonify(get_pro_stats_sync_status())


@app.route('/pro_stats_sync/run', methods=['POST'])
def pro_stats_sync_run():
    league = request.args.get('league') or request.args.get('region') or None
    season_id = request.args.get('season_id') or request.args.get('seasonId') or None
    stage_ids = request.args.get('stage_ids') or request.args.get('stageIds') or None
    try:
        payload = sync_pro_stats(league=league, season_id=season_id, stage_ids=stage_ids)
        return jsonify({
            'ok': True,
            'league': payload['teams'].get('league'),
            'seasonId': payload['teams'].get('seasonId'),
            'stageIds': payload['teams'].get('stageIds'),
            'teams': len(payload['teams'].get('data', [])),
            'players': len(payload['players'].get('data', [])),
            'fetchedAt': payload['teams'].get('fetchedAt'),
        })
    except Exception as exc:
        return json_response({'ok': False, 'error': str(exc)}, status_code=502)


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json or {}
        response = _calibrated_lineup_prediction(data)
        if data.get('includeAi'):
            response['aiAnalysis'] = call_ai_prediction_analysis({
                'mode': 'draft',
                'leftTeam': data.get('left_team') or {},
                'rightTeam': data.get('right_team') or {},
                'result': response,
            })
        return jsonify(response)
    except Exception as e:
        rich_logger.error(f"prediction failed: {e}")
        return json_response({"error": str(e)}, status_code=400)


@app.route('/ai_prediction_config', methods=['GET'])
def ai_prediction_config():
    return jsonify(get_ai_prediction_config())


@app.route('/ai_prediction_config', methods=['POST'])
def ai_prediction_config_save():
    data = request.json or {}
    return jsonify(save_ai_prediction_config(data))


@app.route('/ai_prediction_analysis', methods=['POST'])
def ai_prediction_analysis():
    data = request.json or {}
    return jsonify(call_ai_prediction_analysis(data))


@app.route('/ai_prediction_analysis_stream', methods=['POST'])
def ai_prediction_analysis_stream():
    data = request.json or {}

    def event_stream():
        try:
            for chunk in stream_ai_prediction_analysis(data):
                yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@app.route('/ai_prediction_test', methods=['POST'])
def ai_prediction_test():
    data = request.json or {}
    return jsonify(test_ai_provider_connection(data))


@app.route('/model_diagnostics', methods=['GET'])
def model_diagnostics():
    return jsonify({
        'modelLoaded': model is not None,
        'vectorFields': len(PREDICTION_VECTOR_FIELDS),
        'modelPath': MODEL_LOCAL_PATH,
        'calibration': {
            'lineup': {
                'modelWeight': 0.55,
                'priorWeight': 0.45,
                'minWinRate': 0.05,
                'maxWinRate': 0.95,
            },
            'proMatch': {
                'modelWeight': 0.55,
                'teamStrengthPriorWeight': 0.45,
                'minWinRate': 0.05,
                'maxWinRate': 0.95,
            },
        },
        'knownIssues': [
            '原始 BiLSTM 在不少阵容上仍然偏过度自信，容易给出过高或过低的胜率。',
            '当前训练特征还缺少足够的版本、队伍近期状态、选手状态和资源控制先验。',
            '赛后回测可能预测错误，因为模型不会把最终比分作为赛前输入。',
        ],
        'nextSteps': [
            '扩展赛前特征：加入赛区、版本、红蓝方、首发名单、近期状态、英雄克制关系和源站战队/选手指标。',
            '构建赛后回测数据集：读取已完赛详情，但不把最终比分混入赛前预测输入。',
            '重新训练带校准的模型：按赛区和版本切分验证集，避免随机切分造成的数据泄漏。',
            'AI 提供商只负责生成解释文字，最终概率仍由本地模型和校准逻辑稳定输出。',
        ],
    })


@app.route('/_next/{filename:path}')
def serve_next_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_OUT_DIR, '_next'), filename)


@app.route('/{frontend_path:path}')
def serve_frontend_page(frontend_path):
    if not os.path.isdir(FRONTEND_OUT_DIR):
        return render_template('index.html')

    direct_file = os.path.join(FRONTEND_OUT_DIR, frontend_path)
    nested_index = os.path.join(FRONTEND_OUT_DIR, frontend_path, 'index.html')

    if os.path.isfile(direct_file):
        return send_from_directory(FRONTEND_OUT_DIR, frontend_path)
    if os.path.isfile(nested_index):
        return send_from_directory(os.path.join(FRONTEND_OUT_DIR, frontend_path), 'index.html')
    return send_from_directory(FRONTEND_OUT_DIR, 'index.html')


if __name__ == '__main__':
    start_champion_stats_scheduler()
    start_pro_stats_scheduler()
    uvicorn.run(app, host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '7777')))

