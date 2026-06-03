# -*- coding:utf-8 -*-
# @Project        :LPL
# @FileName       :env.py
# @Time           :2025/3/5 04:13
# @Software       :PyCharm
# @Author         :Viper373
# @Index          :https://viper3.top
# @Blog           :https://blog.viper3.top

import os
import re
import warnings

import orjson
import urllib3
from dotenv import load_dotenv
from fake_useragent import UserAgent

from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()

# 禁用安全警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# orjson配置选项
ORJSON_OPTS = orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS | orjson.OPT_APPEND_NEWLINE

# 项目根目录
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 加载所有以 .env 开头的环境变量文件，优先加载 .env.local
env_files = []
for file_name in os.listdir(project_root):
    if re.match(r'^\.env($|\..*)', file_name):
        env_files.append(file_name)

# 优先加载 .env.local，若不存在或失败则加载 .env
loaded = False
if '.env.local' in env_files:
    env_path = os.path.join(project_root, '.env.local')
    try:
        if load_dotenv(env_path, override=True):
            rich_logger.info(f"[env] 成功加载环境变量文件: {env_path}")
            loaded = True
        else:
            rich_logger.warning(f"无法加载环境变量文件: {env_path}")
    except Exception as e:
        rich_logger.error(f"加载环境变量文件 {env_path} 失败: {e}")

if not loaded and '.env' in env_files:
    env_path = os.path.join(project_root, '.env')
    try:
        if load_dotenv(env_path, override=True):
            rich_logger.info(f"成功加载环境变量文件: {env_path}")
            loaded = True
        else:
            rich_logger.warning(f"无法加载环境变量文件: {env_path}")
    except Exception as e:
        rich_logger.error(f"加载环境变量文件 {env_path} 失败: {e}")

if not loaded:
    rich_logger.warning("未加载任何环境变量文件，将使用系统环境变量")

# 请求头配置
UA = UserAgent().random
AUTHORIZATION = '7935be4c41d8760a28c05581a7b1f570'
GTK = "1568910741"
PROXIES = os.getenv('PROXIES')

# MYSQL 配置（从环境变量中读取）
MYSQL_CONFIG = {
    'MYSQL_HOST': os.getenv('MYSQL_HOST'),
    'MYSQL_PORT': int(os.getenv('MYSQL_PORT')),
    'MYSQL_USER': os.getenv('MYSQL_USER'),
    'MYSQL_PASSWORD': os.getenv('MYSQL_PASSWORD'),
    'MYSQL_CHARSET': os.getenv('MYSQL_CHARSET'),
    'MYSQL_DATABASE': os.getenv('MYSQL_DATABASE'),
}

# 模型相关配置
MODEL_PATH = os.path.join(project_root, 'static', 'saved_model', 'BILSTM_Att.pt')

# ENV相关配置
ENV_SEASONS = os.path.join(project_root, 'Data_CrawlProcess', 'env.py')

# Other相关配置
HERO_LIST = os.path.join(project_root, 'data', 'json', 'hero_list.json')
HERO_LOGO = os.path.join(project_root, 'data', 'json', 'hero_logo.json')
HERO_INFO = os.path.join(project_root, 'data', 'json', 'hero_info.json')
HERO_WIN_RATE = os.path.join(project_root, 'data', 'json', 'hero_win_rate.json')
TEAM_LIST = os.path.join(project_root, 'data', 'json', 'team_list.json')

SEASONS = [
    {"name": "2025LPL第一赛段", "id": "218", "type": "97,100", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=218&stageIds=97,100"},
    {"name": "2025LPL第二赛段", "id": "218", "type": "98,102,103,104", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=218&stageIds=98,102,103,104"},
    {"name": "2024LPL春季赛", "id": "206", "type": "1,5", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=206&stageIds=1,5"},
    {"name": "季中冠军赛", "id": "208", "type": "28,89", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=208&stageIds=28,89"},
    {"name": "2024LPL夏季赛", "id": "206", "type": "90,91,92,8", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=206&stageIds=90,91,92,8"},
    {"name": "全球总决赛", "id": "212", "type": "28,77,18", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=212&stageIds=28,77,18"},
    {"name": "2023LPL春季赛", "id": "190", "type": "1,5", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=190&stageIds=1,5"},
    {"name": "季中冠军赛", "id": "194", "type": "28,85", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=194&stageIds=28,85"},
    {"name": "2023LPL夏季赛", "id": "190", "type": "7,8", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=190&stageIds=7,8"},
    {"name": "全球总决赛", "id": "201", "type": "18,28,77", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=201&stageIds=18,28,77"},
    {"name": "LPL春季赛", "id": "167", "type": "1,5", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=167&stageIds=1,5"},
    {"name": "季中冠军赛", "id": "175", "type": "19,55", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=175&stageIds=19,55"},
    {"name": "LPL夏季赛", "id": "167", "type": "7,8,9", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=167&stageIds=7,8,9"},
    {"name": "全球总决赛", "id": "184", "type": "18,19,28", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=184&stageIds=18,19,28"},
    {"name": "LPL春季赛", "id": "148", "type": "1,5", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=148&stageIds=1,5"},
    {"name": "LPL夏季赛", "id": "148", "type": "7,8", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=148&stageIds=7,8"},
    {"name": "全球总决赛", "id": "156", "type": "18,19,28", "url": "https://lpl.qq.com/web202301/rank.html?seasonId=156&stageIds=18,19,28"},
    {"name": "LPL春季赛", "id": "134", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=134&amp;sGameType=1,5"},
    {"name": "LPL夏季赛", "id": "134", "type": "7,8", "url": "https://lpl.qq.com/es/data/rank.shtml?iGameId=134&sGameType=7,8"},
    {"name": "LPL春季赛", "id": "115", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=115&amp;sGameType=1,5"},
    {"name": "LPL夏季赛", "id": "115", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=115&amp;sGameType=7,8"},
    {"name": "LPL春季赛", "id": "95", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=95&amp;sGameType=1,5"},
    {"name": "LPL夏季赛", "id": "95", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=95&amp;sGameType=7,8"},
    {"name": "德玛西亚杯", "id": "132", "type": "19", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=132&amp;sGameType=19"},
    {"name": "LPL春季赛", "id": "49", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=49&amp;sGameType=1,5"},
    {"name": "LPL夏季赛", "id": "49", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=49&amp;sGameType=7,8"},
    {"name": "LSPL春季赛", "id": "50", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=50&amp;sGameType=1,5"},
    {"name": "LSPL夏季赛", "id": "50", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=50&amp;sGameType=7,8"},
    {"name": "德玛西亚杯长沙站", "id": "70", "type": "18", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=70&amp;sGameType=18"},
    {"name": "德玛西亚杯青岛站", "id": "93", "type": "18", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=93&amp;sGameType=18"},
    {"name": "季中冠军赛", "id": "59", "type": "18,19", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=59&amp;sGameType=18,19"},
    {"name": "2017全球总决赛", "id": "58", "type": "18,19", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=58&amp;sGameType=18,19"},
    {"name": "LPL春季赛", "id": "16", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=16&amp;sGameType=1,5"},
    {"name": "LPL夏季赛", "id": "16", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=16&amp;sGameType=7,8"},
    {"name": "LSPL春季赛", "id": "17", "type": "1,5", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=17&amp;sGameType=1,5"},
    {"name": "LSPL夏季赛", "id": "17", "type": "7,8", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=17&amp;sGameType=7,8"},
    {"name": "季中冠军赛", "id": "26", "type": "18,19", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=26&amp;sGameType=18,19"},
    {"name": "全球总决赛", "id": "38", "type": "18,19", "url": "//lpl.qq.com/es/data/rank.shtml?iGameId=38&amp;sGameType=18,19"},
]
