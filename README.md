---
title: LOL-DeepWinPredictor
emoji: 🎮
colorFrom: blue
colorTo: yellow
sdk: docker
sdk_version: "1.0"
app_file: api/app.py
pinned: false
---

![LOL-DeepWinPredictor](https://socialify.git.ci/Viper373/LOL-DeepWinPredictor/image?description=1&font=Source+Code+Pro&forks=1&issues=1&logo=https%3A%2F%2Fimg.viper3.top%2FLOL-DeepWinPredictor%2Flogo.png&name=1&owner=1&pulls=1&stargazers=1&theme=Light)

# LOL-DeepWinPredictor

基于职业赛事数据、英雄分路数据和本地深度学习模型的 League of Legends 胜率预测与赛事分析系统。

当前版本已经迁移到 **FastAPI + Next.js 静态前端**，并补充了 OP.GG Esports、101.qq.com、lpl.qq.com 的职业赛事、战队、选手、英雄和赛程数据同步能力。项目仍保留原始 BiLSTM-Attention 模型，同时提供校准预测、AI 提供商配置、职业赛程预测、小场预测与 LPL 实时数据探测入口。

## 功能概览

- 阵容胜率预测：输入蓝红双方队伍、英雄和分路后，输出校准后的胜率、置信度和胜方。
- 职业赛程：按赛区和日期查看比赛，支持已结束比赛回测、未赛比赛预测、LPL 官方详情链接和 OP.GG 详情链接。
- 小场预测：支持对 BO 系列中的单局比赛按 BP 阵容预测，并在有赛后小场数据时做回测校正。
- 英雄数据：同步 OP.GG 与 101.qq.com 的英雄排行、分路、段位、禁用率、登场率、热度、胜率、对位、符文、召唤师技能、出装和技能信息。
- 战队数据：同步 OP.GG Esports 与 LPL 官方战队统计，包括排名、胜负、KDA、经济、击杀、近期比赛、赛程和队员信息。
- 选手数据：同步职业选手列表、排行榜、队伍、位置、KDA、DPM、GPM、参团率、常用英雄和详情面板。
- AI 提供商：独立页面配置 Base URL、API Key、模型名、启用状态和测试调用，用于赛前/赛中解释与分析。
- LPL 实时探测：提供候选比赛和探测入口，用于尝试抓取 LPL 官方实时事件/状态数据，为后续实时胜率曲线做准备。
- 模型诊断：展示本地模型加载状态、特征维度、校准策略、已知问题和下一步训练方向。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 API | FastAPI, Uvicorn, Python |
| 模型推理 | PyTorch, BiLSTM-Attention |
| 前端 | Next.js, React, TypeScript, Tailwind CSS, Radix UI |
| 数据源 | OP.GG Esports, OP.GG Champion Stats, 101.qq.com, lpl.qq.com |
| 数据存储 | 本地 JSON 缓存, MySQL, MongoDB 可选 |
| 可选 AI | OpenAI 兼容接口，支持自定义 Base URL 与 API Key |

## 项目结构

```text
.
├── api/
│   ├── app.py                 # FastAPI 入口，兼容旧接口并服务前端静态页面
│   └── ai_prediction.py       # AI 提供商配置、保存和调用逻辑
├── BILSTM_Att/                # BiLSTM-Attention 模型、训练和预测脚本
├── Data_CrawlProcess/
│   ├── champion_stats_sync.py # OP.GG/101 英雄数据同步与缓存
│   ├── team_player_stats_sync.py
│   │                           # OP.GG Esports/LPL 战队、选手、赛程、比赛详情同步
│   └── lpl_live_probe.py      # LPL 实时数据探测
├── frontend/
│   ├── app/                   # Next.js 页面
│   ├── components/            # UI 与业务组件
│   ├── lib/                   # API client、类型、工具函数
│   └── public/                # 图标和旧资源副本
├── old_frontend/              # 旧版静态前端备份
├── scripts/
│   └── probe_lpl_live.py      # 命令行 LPL 实时探测
├── data/json/                 # 本地数据和同步缓存
├── static/saved_model/        # 本地模型权重目录
└── requirements.txt
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Viper373/LOL-DeepWinPredictor.git
cd LOL-DeepWinPredictor
```

### 2. 安装 Python 依赖

建议使用 Python 3.10+。

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. 安装并构建前端

```bash
cd frontend
npm install
npm run build
cd ..
```

后端会优先服务 `frontend/out`，所以生产模式或本地完整体验都建议先构建前端。

### 4. 启动服务

```bash
python -m api.app
```

默认访问地址：

- Web UI: http://127.0.0.1:5000
- API 文档: http://127.0.0.1:5000/docs

可选端口配置：

```bash
set PORT=8000
python -m api.app
```

## 环境变量

项目会读取 `.env.local` 或 `.env`。本地开发时不要提交真实密钥。

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| MYSQL_HOST | MySQL 地址 | 可选 |
| MYSQL_PORT | MySQL 端口 | 可选 |
| MYSQL_USER | MySQL 用户名 | 可选 |
| MYSQL_PASSWORD | MySQL 密码 | 可选 |
| MYSQL_DATABASE | MySQL 数据库名 | 可选 |
| MONGO_URI | MongoDB 连接地址 | 可选 |
| PROXY | 请求外部源站时使用的代理配置 | 可选 |
| HOST | FastAPI 监听地址，默认 `0.0.0.0` | 可选 |
| PORT | FastAPI 端口，默认 `5000` | 可选 |
| AI_PROVIDER | AI 提供商名称 | 可选 |
| AI_BASE_URL | OpenAI 兼容接口 Base URL | 可选 |
| AI_API_KEY | AI API Key | 可选 |
| AI_MODEL | AI 模型名 | 可选 |

AI 配置也可以在前端“AI 提供商”页面保存到本地配置文件。配置文件默认位于 `data/json/ai_provider_config.json`，该文件已加入 `.gitignore`。

## 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/query_win_rate` | 查询 OP.GG 英雄排行数据 |
| GET | `/query_cn_win_rate` | 查询 101.qq.com 英雄排行数据 |
| GET | `/query_champion_detail` | 查询英雄详情、对位、符文、出装等数据 |
| GET | `/query_pro_leagues` | 查询职业赛区 |
| GET | `/query_pro_schedule` | 查询职业赛程 |
| GET | `/query_pro_match_detail` | 查询比赛详情 |
| GET | `/query_team_stats` | 查询战队统计 |
| GET | `/query_player` | 查询选手列表 |
| GET | `/query_player_detail` | 查询选手详情 |
| POST | `/predict` | 阵容胜率预测 |
| POST | `/predict_pro_match` | 职业比赛 BO 预测 |
| POST | `/predict_pro_game` | 单局小场预测与回测 |
| POST | `/live_prediction` | 手动实时状态预测 |
| GET/POST | `/lpl_live_probe/run` | LPL 实时数据源探测 |
| GET/POST | `/ai_prediction_config` | AI 提供商配置读取/保存 |
| POST | `/ai_prediction_test` | AI 提供商连通性测试 |
| GET | `/model_diagnostics` | 模型诊断信息 |

## 数据同步

英雄、战队、选手和赛程接口默认会优先读取本地缓存，并在需要时触发同步。

也可以手动触发：

```bash
# 英雄数据
curl -X POST "http://127.0.0.1:5000/champion_stats_sync/run?region=global&tier=all"

# 职业战队/选手/赛程
curl -X POST "http://127.0.0.1:5000/pro_stats_sync/run?league=LPL"

# LPL 实时探测
python scripts/probe_lpl_live.py
```

缓存目录：

- `data/json/champion_stats/`
- `data/json/pro_stats/`
- `data/json/live_probe/`

这些缓存目录默认不提交到 git，避免把源站临时结果和本地抓取状态混进代码版本。

## 模型说明

原始模型是 BiLSTM-Attention，输入双方队伍与英雄 BP 特征后输出胜率。当前版本对原始输出做了校准：

- 阵容预测会融合队伍强度、英雄分路胜率先验和模型输出。
- 职业 BO 预测会融合 OP.GG/LPL 的战队近期统计。
- 小场预测会先按 BP 阵容给出赛前判断；如果比赛详情中已有击杀、经济、资源、时长等小场数据，会额外输出 `liveAdjustedAWin/liveAdjustedBWin` 和 `backtest`。

因此，已结束比赛里可能出现“赛前预测错、赛后状态校正命中”的情况。这不是接口错误，而是当前模型没有把最终比分当作输入，真正赛前预测只能基于赛前 BP 和历史强度。

## AI 提供商与实时预测

AI 提供商用于解释和总结，不建议直接让大模型决定最终胜率。推荐用法：

1. 本地模型或规则模型给出概率。
2. AI 根据队伍状态、BP、版本、选手和实时事件生成解释。
3. 赛中实时预测优先依赖结构化事件流，例如经济差、人头差、大小龙、防御塔、装备和时长。

当前已提供：

- AI 配置页面。
- 提供商连通性测试。
- 手动实时状态预测接口。
- LPL 官方实时数据探测入口。

真正稳定的自动实时胜率曲线仍需要长期采集 LPL 实时事件并重新训练时间序列模型。

## 开发命令

```bash
# 后端语法检查
python -m py_compile api/app.py

# 前端类型检查
cd frontend
npx tsc --noEmit

# 前端生产构建
npm run build

# 启动 FastAPI
cd ..
python -m api.app
```

## 发布流程

```bash
git status
python -m py_compile api/app.py
cd frontend && npx tsc --noEmit && npm run build && cd ..
git add .
git commit -m "Release: FastAPI migration and pro data workflows"
git push origin main
gh release create <tag> --title "<title>" --notes "<release notes>"
```

发布前请确认没有提交：

- `.env.local`
- `data/json/ai_provider_config.json`
- `frontend/node_modules/`
- `frontend/out/`
- `frontend/.next/`
- 抓取缓存和日志目录

## 注意事项

- OP.GG、101.qq.com、lpl.qq.com 页面结构和接口可能变化，同步逻辑需要随源站更新维护。
- 如果源站有 WAF 或频率限制，优先做缓存、退避、代理和合规限频，不要在前端阻塞式反复请求。
- 当前训练模型存在过拟合和校准不足的问题；严肃预测应重新构建样本、加入更多赛中和版本特征，并按赛季/版本做验证集切分。
- 所有 API Key、Cookie、Token 都不应提交到仓库。

## License

本项目用于学习、研究和数据分析展示。使用第三方源站数据时请遵守对应网站的服务条款。
