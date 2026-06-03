# LOL-DeepWinPredictor

LOL-DeepWinPredictor 是一个面向英雄联盟职业赛事的数据分析与胜率预测系统。项目以本地 BiLSTM-Attention 模型为核心，结合职业战队、选手、英雄分路胜率、BP 阵容、赛程与比赛详情数据，提供赛前预测、职业赛程预测、单局小场预测、英雄/战队/选手数据面板和 AI 分析解释能力。

当前版本已经迁移为 **FastAPI + Next.js 静态前端**。后端负责模型推理、数据同步、缓存和 API；前端负责交互式预测、数据面板和职业赛程展示。

## 重要说明：实时预测模块已移除

项目不再提供自动比赛实时胜率预测模块，也不再在前端暴露 LPL 实时探针页面。

原因是稳定的实时胜率曲线依赖结构化、连续、低延迟的局内数据流，例如游戏时间、经济差、人头差、防御塔、小龙、大龙、先锋、装备差、等级差、视野、团战事件和资源归属变化。公开页面上的赛后详情和普通赛程接口无法稳定提供这种实时事件流；直播画面中的商业预测曲线通常来自赛事方、转播方或合作数据商的内部实时数据通道，并不是公开接口可直接复刻的能力。

虽然仓库中保留了一些 LPL 数据探针脚本，用于研究官方比赛详情字段是否变化，但它们只能证明“某些详情字段可以被轮询到”，不能保证实时、完整、授权、低延迟和可训练。基于这一现实，自动实时预测预计长期不会实现。项目后续重点会放在赛前预测、BP 后预测、职业赛程预测、小场预测回测、模型校准和数据面板完善上。

## 功能概览

- 胜率预测：选择蓝红双方队伍、分路英雄和禁用英雄后，输出本地模型胜率、队伍与阵容先验、校准后胜率、置信度和胜方判断。
- 流式 AI 分析：配置 OpenAI Compatible 提供商后，胜率预测模块可以流式生成中文赛前/BP 分析。AI 只解释模型结果，不直接决定最终胜率。
- 英雄数据：整合 OP.GG 与 101.qq.com 的英雄排行、分路、段位、禁用率、登场率、热度、胜率、对位、符文、召唤师技能、出装和技能数据。
- 战队数据：整合 OP.GG Esports 与 lpl.qq.com 的职业战队排名、胜负、KDA、经济、击杀、资源控制、近期比赛、后续赛程、队员和详情面板。
- 选手数据：整合职业选手列表、排行榜、队伍、位置、头像、KDA、DPM、GPM、参团率、常用英雄和详情面板。
- 职业赛程：按赛区、日期和队伍查看比赛，显示比赛时间、状态、队标、比分、倒计时、源站详情链接和 AI 预测入口。
- 小场预测：支持对 BO 系列中的单局比赛按 BP 阵容预测；如果比赛详情包含赛后小场数据，可做回测校正。
- AI 提供商：独立页面配置 Provider、Base URL、API Key、模型名和启用状态；测试连接只验证连通性，不输出比赛胜率。
- 模型实验室：展示模型加载状态、输入维度、校准策略、已知问题和后续训练路线。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 API | FastAPI, Uvicorn, Python |
| 模型推理 | PyTorch, BiLSTM-Attention |
| 前端 | Next.js, React, TypeScript, Tailwind CSS, Radix UI |
| 数据源 | OP.GG Esports, OP.GG Champion Stats, 101.qq.com, lpl.qq.com |
| 数据缓存 | 本地 JSON 缓存，MySQL / MongoDB 可选 |
| AI 分析 | OpenAI Compatible API，自定义 Base URL 与 API Key |

## 项目结构

```text
.
├── api/
│   ├── app.py                 # FastAPI 入口，兼容旧 Flask 风格路由并服务静态前端
│   ├── ai_prediction.py       # AI 提供商配置、连接测试、非流式/流式分析调用
│   └── model_storage.py       # 本地/远程模型加载，支持 URL、S3/R2/OSS、WebDAV
├── BILSTM_Att/                # BiLSTM-Attention 模型、训练和预测脚本
├── Data_CrawlProcess/
│   ├── champion_stats_sync.py # OP.GG/101 英雄数据同步与缓存
│   ├── team_player_stats_sync.py
│   │                          # OP.GG Esports/LPL 战队、选手、赛程、比赛详情同步
│   └── lpl_live_probe.py      # 仅保留为内部研究探针，不作为产品实时预测功能
├── frontend/
│   ├── app/                   # Next.js 页面
│   ├── components/            # UI 与业务组件
│   ├── lib/                   # API client、类型、工具函数和状态管理
│   └── public/                # 图标和静态资产
├── old_frontend/              # 旧版静态前端备份
├── scripts/                   # 命令行辅助脚本
├── data/json/                 # 本地数据与同步缓存
├── static/saved_model/        # 本地模型权重目录
├── requirements.txt
├── Dockerfile
└── README.md
```

## 快速开始

### 1. 克隆项目

```bash
git clone git@github.com:Flames1217/LOL-DeepWinPredictor.git
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

后端会优先服务 `frontend/out`，因此完整本地体验或生产部署前建议先构建前端。

### 4. 启动服务

```bash
python -m api.app
```

默认访问地址：

- Web UI: http://127.0.0.1:5000
- API 文档: http://127.0.0.1:5000/docs

可通过环境变量修改端口：

```bash
set PORT=8000
python -m api.app
```

## 环境变量

项目会读取 `.env.local` 或 `.env`。不要把真实密钥提交到仓库。

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| HOST | FastAPI 监听地址，默认 `0.0.0.0` | 否 |
| PORT | FastAPI 端口，默认 `5000` | 否 |
| MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE | 可选 MySQL 配置 | 否 |
| MONGO_URI | 可选 MongoDB 连接地址 | 否 |
| PROXY | 请求外部源站时使用的代理 | 否 |
| AI_PROVIDER | AI 提供商，例如 `openai-compatible`、`openai`、`ollama` | 否 |
| AI_BASE_URL | OpenAI Compatible Base URL，例如 `https://api.example.com/v1` | 否 |
| AI_API_KEY | AI API Key | 否 |
| AI_MODEL | AI 模型名 | 否 |
| MODEL_PATH | 本地模型路径，默认 `static/saved_model/BILSTM_Att.pt` | 否 |
| MODEL_URL | 远程模型 HTTPS URL，本地模型不存在时下载 | 否 |
| S3_MODEL_URL | S3/R2/OSS 公网或预签名模型 URL | 否 |
| WEBDAV_MODEL_URL | WebDAV 直连模型文件 URL | 否 |
| MODEL_CACHE_DIR | 远程模型下载后的缓存目录，Serverless 默认 `/tmp/lol-deepwin-models` | 否 |
| MODEL_FILENAME | 缓存模型文件名，默认从 URL 推断 | 否 |
| MODEL_SHA256 | 模型 sha256 校验值 | 否 |
| WEBDAV_USERNAME / WEBDAV_PASSWORD | WebDAV Basic Auth | 否 |
| MODEL_BASIC_AUTH_USER / MODEL_BASIC_AUTH_PASSWORD | 受保护 HTTP 模型地址的 Basic Auth | 否 |
| NEXT_PUBLIC_API_BASE_URL | 前后端分离部署时的后端 API 域名 | 否 |

AI 配置也可以在前端“AI 提供商”页面保存到 `data/json/ai_provider_config.json`。该文件默认不提交到 Git。

## AI 提供商配置

AI 提供商用于解释预测结果和生成分析文字。最终胜率仍由本地模型与校准逻辑输出，AI 不负责直接给出或覆盖胜率。

Base URL 会自动归一化：

- `api.example.com` 会补全为 `https://api.example.com/v1`
- `https://api.example.com/v1` 会保持不变
- `https://api.example.com/v1/chat/completions` 会去掉重复 endpoint 后再调用
- Ollama 本地地址可使用 `localhost:11434`

测试连接只验证 Provider、Base URL、模型名和 API Key 是否能调用成功，不会显示任何蓝红方胜率。

## 数据同步

英雄、战队、选手和赛程接口会优先读取本地缓存，并在需要时触发同步。也可以手动触发：

```bash
# 英雄数据
curl -X POST "http://127.0.0.1:5000/champion_stats_sync/run?region=global&tier=all"

# 职业战队 / 选手 / 赛程
curl -X POST "http://127.0.0.1:5000/pro_stats_sync/run?league=LPL"
```

主要缓存目录：

- `data/json/champion_stats/`
- `data/json/pro_stats/`
- `data/json/live_probe/`：仅为内部研究探针缓存，不作为产品实时预测数据源

这些缓存目录默认不提交到 Git，避免把源站临时结果、本地抓取状态和调试数据混进代码版本。

## 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/query_hero` | 查询基础英雄列表 |
| GET | `/query_win_rate` | 查询 OP.GG 英雄排行数据 |
| GET | `/query_cn_win_rate` | 查询 101.qq.com 英雄排行数据 |
| GET | `/query_champion_detail` | 查询英雄详情、对位、符文、出装等数据 |
| GET | `/query_pro_leagues` | 查询职业赛区 |
| GET | `/query_pro_schedule` | 查询职业赛程 |
| GET | `/query_pro_match_detail` | 查询比赛详情 |
| GET | `/query_team_stats` | 查询战队统计 |
| GET | `/query_team_detail` | 查询战队详情 |
| GET | `/query_player` | 查询选手列表 |
| GET | `/query_player_detail` | 查询选手详情 |
| POST | `/predict` | 阵容胜率预测 |
| POST | `/predict_pro_match` | 职业比赛 BO 预测 |
| POST | `/predict_pro_game` | 单局小场预测与回测 |
| GET/POST | `/ai_prediction_config` | AI 提供商配置读取/保存 |
| POST | `/ai_prediction_test` | AI 提供商连通性测试 |
| POST | `/ai_prediction_analysis` | 非流式 AI 分析 |
| POST | `/ai_prediction_analysis_stream` | 流式 AI 分析 |
| GET | `/model_diagnostics` | 模型诊断信息 |

## 模型说明

原始模型是 BiLSTM-Attention，输入双方队伍与英雄 BP 特征后输出胜率。当前版本在原始输出上增加了校准逻辑：

- 阵容预测融合队伍强度、英雄分路胜率先验和模型输出。
- 职业 BO 预测融合 OP.GG/LPL 的战队近期统计。
- 小场预测先按 BP 阵容给出赛前判断；如果比赛详情中已有击杀、经济、资源、时长等小场数据，会额外输出 `liveAdjustedAWin/liveAdjustedBWin` 与 `backtest`。

因此，已结束比赛里可能出现“赛前预测错、赛后状态校正命中”的情况。这不是接口错误，而是赛前预测本来不能把最终比分当作输入。严格评估模型时需要区分：

- 赛前预测：只允许使用赛前队伍、版本、历史表现和 BP 信息。
- 赛后回测：允许使用比赛详情中的实际局内结果和统计。

当前模型仍存在过拟合和校准不足风险。后续训练应增加版本、赛区、选手状态、蓝红方、英雄交互、队伍近期强度、小场细节等特征，并按赛季/版本切分验证集，避免随机切分导致虚高表现。

## 部署建议

推荐部署形态是：**前端部署到 Vercel，FastAPI 后端部署到支持常驻 Python 进程的平台，模型放到 S3/R2/OSS 或 WebDAV**。

Vercel 可以运行轻量 Python Functions，但本项目后端包含 PyTorch、模型下载、数据同步、外部源站请求和缓存逻辑，更适合常驻服务。Serverless 环境容易遇到冷启动、函数体积、执行时长、临时文件和模型加载限制。

### 方案 A：前端 Vercel + 独立 FastAPI 后端

1. 在 Vercel 新建项目，Root Directory 选择 `frontend`。
2. Build Command 使用 `npm run build`。
3. Output Directory 使用 `out`。
4. 配置前端环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

5. 后端部署到 Render、Railway、Fly.io、Koyeb、Docker VPS 或其他支持常驻 Python 服务的平台。
6. 后端配置模型远程地址：

```bash
MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt
MODEL_SHA256=<optional_sha256>
```

S3/R2/OSS 可以使用公开只读 URL、CDN URL 或预签名 URL：

```bash
S3_MODEL_URL=https://bucket.s3.amazonaws.com/models/BILSTM_Att.pt
```

WebDAV：

```bash
WEBDAV_MODEL_URL=https://webdav.example.com/models/BILSTM_Att.pt
WEBDAV_USERNAME=your_user
WEBDAV_PASSWORD=your_password
```

### 方案 B：后端尝试 Vercel Python Functions

可以实验，但不建议作为主生产方案：

- 不要把 `static/saved_model/BILSTM_Att.pt` 提交进仓库。
- 必须配置 `MODEL_URL` / `S3_MODEL_URL` / `WEBDAV_MODEL_URL`。
- 缓存目录只能依赖临时目录，冷启动时可能重新下载模型。
- 数据同步不应依赖后台常驻任务，应改为手动触发或外部定时任务。
- 如果模型下载和 PyTorch 初始化导致冷启动过慢，需要把推理服务拆到常驻后端。

### Docker

```bash
docker build -t lol-deepwinpredictor .
docker run -p 7860:7860 \
  -e MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt \
  lol-deepwinpredictor
```

## 开发命令

```bash
# 后端语法检查
python -m py_compile api/app.py api/ai_prediction.py

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
python -m py_compile api/app.py api/ai_prediction.py
cd frontend
npx tsc --noEmit
npm run build
cd ..
git add <changed-files>
git commit -m "Release: describe change"
git push origin main
gh release create <tag> --title "<title>" --notes "<release notes>"
```

发布前请确认没有提交：

- `.env.local`
- `data/json/ai_provider_config.json`
- `frontend/node_modules/`
- `frontend/out/`
- `frontend/.next/`
- 本地抓取缓存和日志目录

## 注意事项

- OP.GG、101.qq.com、lpl.qq.com 的页面结构和接口可能变化，同步逻辑需要随源站维护。
- 如果源站有 WAF 或频率限制，优先做缓存、退避、代理和合规限频，不要在前端阻塞式反复请求。
- API Key、Cookie、Token 和代理凭证都不应提交到仓库。
- 本项目用于学习、研究和数据分析展示。使用第三方源站数据时，请遵守对应网站的服务条款。

## License

本项目用于学习、研究和数据分析展示。模型预测结果不构成投注、投资或任何商业决策建议。
