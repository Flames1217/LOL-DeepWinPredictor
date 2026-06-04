# LOL-DeepWinPredictor

<p align="center">
  <img src="https://socialify.git.ci/Flames1217/LOL-DeepWinPredictor/image?description=1&font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating%20Cogs&pulls=1&stargazers=1&theme=Auto" alt="LOL-DeepWinPredictor" width="720">
</p>

<p>
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/python.svg" width="18" style="vertical-align:-3px" alt="Python"> Python&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/fastapi.svg" width="18" style="vertical-align:-3px" alt="FastAPI"> FastAPI&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/pytorch.svg" width="18" style="vertical-align:-3px" alt="PyTorch"> PyTorch&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/nextdotjs.svg" width="18" style="vertical-align:-3px" alt="Next.js"> Next.js&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/react.svg" width="18" style="vertical-align:-3px" alt="React"> React&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/typescript.svg" width="18" style="vertical-align:-3px" alt="TypeScript"> TypeScript&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/tailwindcss.svg" width="18" style="vertical-align:-3px" alt="Tailwind CSS"> Tailwind CSS&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/mysql.svg" width="18" style="vertical-align:-3px" alt="MySQL"> MySQL
</p>

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FFlames1217%2FLOL-DeepWinPredictor&project-name=lol-deepwinpredictor&repository-name=LOL-DeepWinPredictor"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/Flames1217/LOL-DeepWinPredictor"><img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify"></a>
  <a href="https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FFlames1217%2FLOL-DeepWinPredictor"><img src="https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg" alt="Deploy with EdgeOne Pages"></a>
</p>

LOL-DeepWinPredictor 是一个面向英雄联盟职业赛事的数据分析与胜率预测系统。项目使用本地 BiLSTM-Attention 模型做基础推理，并接入 `101.qq.com`、`OP.GG`、`esports.op.gg`、`lpl.qq.com` 的实时数据接口，提供阵容胜率预测、职业赛程预测、小场预测、英雄/战队/选手数据面板、比赛详情和流式 AI 分析。

当前版本已迁移到 **FastAPI + Next.js 静态前端**。后端负责模型推理、数据同步、缓存、AI 提供商调用和 API；前端负责交互式预测、数据面板和职业赛程展示。

## ✨ 功能

- 🏆 **胜率预测**：选择蓝红方战队、分路英雄和 Ban 位后，输出本地模型胜率、阵容先验、校准后胜率、置信度和胜方判断。
- 🌊 **流式 AI 分析**：配置 OpenAI Compatible 提供商后，在胜率预测模块流式生成中文 BP 分析和赛前解释。AI 只解释模型结果，不直接覆盖最终胜率。
- 🧙 **英雄数据**：接入 OP.GG 与 101.qq.com 的英雄排行、分路、段位、禁用率、登场率、热度、胜率、对位、符文、召唤师技能、出装和技能数据。
- 🛡️ **战队数据**：接入 OP.GG Esports 与 lpl.qq.com 的职业战队排名、胜负、KDA、经济、击杀、资源控制、近期比赛、后续赛程、队员和详情数据。
- 👤 **选手数据**：展示职业选手列表、排行榜、队伍、位置、头像、KDA、DPM、GPM、参团率、英雄池和详情面板。
- 📅 **职业赛程**：按赛区、日期和队伍查询比赛，展示比赛时间、状态、队标、比分、开赛倒计时、AI 预测入口和源站详情链接。
- 🎮 **小场预测**：支持 BO 系列中的单局比赛按 BP 阵容预测；如果详情里已有赛后小场数据，则可做回测校正。
- 🔌 **AI 提供商**：独立页面配置 Provider、Base URL、API Key、模型名和启用状态；测试连接只验证连通性，不输出比赛胜率。
- 🧪 **模型实验室**：展示模型加载状态、输入维度、校准策略、已知问题和后续训练路线。

## ⚠️ 关于实时比赛预测

项目不提供自动比赛实时胜率曲线，也不保留前端的 LPL 实时探针模块。

稳定的实时胜率预测依赖结构化、连续、低延迟的局内数据流，例如游戏时间、经济差、人头差、防御塔、小龙、大龙、先锋、装备差、等级差、视野、团战事件和资源归属变化。公开网页上的赛程和赛后详情通常只提供赛前信息或赛后统计，无法稳定提供这种实时事件流。直播画面里的商业实时预测曲线通常来自赛事方、转播方或合作数据商的内部通道，不是公开接口可以直接复刻的能力。

因此，实时预测预计会长期不实现。项目后续重点会放在赛前预测、BP 后预测、职业赛程预测、小场预测/回测、模型校准和数据面板完善上。如果未来拿到合法授权的低延迟实时数据流，可以在现有小场预测接口上扩展增量事件输入，但这将是新的数据工程和模型训练任务。

## 🧱 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 API | <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/fastapi.svg" width="16" style="vertical-align:-3px" alt="FastAPI"> FastAPI, Uvicorn, Python |
| 模型推理 | <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/pytorch.svg" width="16" style="vertical-align:-3px" alt="PyTorch"> PyTorch, BiLSTM-Attention |
| 前端 | <img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/nextdotjs.svg" width="16" style="vertical-align:-3px" alt="Next.js"> Next.js, React, TypeScript, Tailwind CSS, Radix UI |
| 数据源 | OP.GG, OP.GG Esports, 101.qq.com, lpl.qq.com |
| 缓存 | 本地实时接口缓存；<img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/mysql.svg" width="16" style="vertical-align:-3px" alt="MySQL"> MySQL 仅用于站点访问统计 |
| AI 分析 | OpenAI Compatible API，自定义 Base URL、API Key 和模型 |

## 📁 项目结构

```text
.
├── api/
│   ├── app.py                 # FastAPI 入口，提供 API 并托管静态前端
│   ├── ai_prediction.py       # AI 提供商配置、连接测试、流式/非流式分析
│   └── model_storage.py       # 本地模型与 MODEL_URL 远程模型加载
├── BILSTM_Att/                # BiLSTM-Attention 模型、训练和预测脚本
├── Data_CrawlProcess/
│   ├── champion_stats_sync.py # OP.GG/101 英雄数据同步与缓存
│   ├── team_player_stats_sync.py
│   │                         # OP.GG Esports/LPL 战队、选手、赛程、详情同步
│   └── env.py                 # 源站请求和基础路径配置
├── frontend/
│   ├── app/                   # Next.js 页面
│   ├── components/            # UI 与业务组件
│   ├── lib/                   # API client、类型、工具函数
│   └── public/                # 图标和静态资源
├── scripts/                   # 辅助脚本
├── data/json/                 # 运行期缓存目录，不保存旧种子数据
├── static/saved_model/        # 默认本地模型目录
├── requirements.txt
├── Dockerfile
└── README.md
```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone git@github.com:Flames1217/LOL-DeepWinPredictor.git
cd LOL-DeepWinPredictor
```

### 2. 安装后端依赖

建议使用 Python 3.10+。

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. 构建前端

```bash
cd frontend
npm install
npm run build
cd ..
```

FastAPI 会优先托管 `frontend/out`，所以完整本地体验或生产部署前建议先构建前端。

### 4. 启动服务

```bash
python -m api.app
```

默认地址：

- Web UI: `http://127.0.0.1:7777`
- API 文档: `http://127.0.0.1:7777/docs`

修改端口：

```bash
set PORT=7777
python -m api.app
```

## 🔐 环境变量

项目会读取 `.env.local` 或 `.env`。不要把真实密钥提交到仓库。

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| `HOST` | FastAPI 监听地址，默认 `0.0.0.0` | 否 |
| `PORT` | FastAPI 端口，默认 `7777` | 否 |
| `MYSQL_URL` | MySQL 连接字符串，仅用于站点访问统计；留空则关闭数据库写入 | 否 |
| `MODEL_URL` | 远程模型文件地址；支持 HTTPS 直连、WebDAV HTTPS、公开 `s3://bucket/key` 和 S3/R2/OSS 预签名 HTTPS | 否 |
| `AI_PROVIDER` | AI 提供商，例如 `openai-compatible`、`openai`、`ollama` | 否 |
| `AI_BASE_URL` | OpenAI Compatible Base URL，例如 `https://api.example.com/v1` | 否 |
| `AI_API_KEY` | AI API Key | 否 |
| `AI_MODEL` | AI 模型名 | 否 |
| `NEXT_PUBLIC_API_BASE_URL` | 前后端分离部署时的后端 API 域名 | 否 |
| `PROXIES` | 请求外部源站时使用的代理 | 否 |

最小示例：

```bash
HOST=0.0.0.0
PORT=7777
MYSQL_URL=mysql://user:password@127.0.0.1:3306/lol_deepwinpredictor?charset=utf8mb4
MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### 远程模型 URL

只需要配置一个 `MODEL_URL`：

- HTTPS / CDN: `MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt`
- WebDAV: `MODEL_URL=https://webdav.example.com/models/BILSTM_Att.pt`
- S3/R2/OSS 预签名: `MODEL_URL=https://bucket.example.com/models/BILSTM_Att.pt?...`
- 公开 S3 简写: `MODEL_URL=s3://bucket/models/BILSTM_Att.pt`

如果仓库内默认模型 `static/saved_model/BILSTM_Att.pt` 存在，后端会优先使用本地模型；本地模型不存在时才会下载 `MODEL_URL`。

## 🔌 AI 提供商

AI 提供商用于解释预测结果和生成分析文字。最终胜率仍由本地模型与校准逻辑输出，AI 不负责直接给出或覆盖胜率。

Base URL 会自动归一化：

- `api.example.com` 会补全为 `https://api.example.com/v1`
- `https://api.example.com/v1` 会保持不变
- `https://api.example.com/v1/chat/completions` 会去掉重复 endpoint 后再调用
- Ollama 本地地址可使用 `localhost:11434`

测试连接只验证 Provider、Base URL、模型名和 API Key 是否可调用成功，不会显示任何蓝红方胜率。

## 📡 数据接口与缓存

英雄、战队、选手和赛程接口优先读取运行期缓存，并在需要时触发同步。项目已经删除旧的本地种子 JSON 和旧前端接口，不再使用 `/query_hero`、`/query_team`、`/get_echarts_data` 这类历史入口。

手动同步：

```bash
# 英雄数据
curl -X POST "http://127.0.0.1:7777/champion_stats_sync/run?region=global&tier=all"

# 职业战队 / 选手 / 赛程
curl -X POST "http://127.0.0.1:7777/pro_stats_sync/run?league=LPL"
```

主要缓存目录：

- `data/json/champion_stats/`
- `data/json/pro_stats/`

这些缓存目录默认不提交到 Git，避免把源站临时结果、本地抓取状态和调试数据混入代码版本。

## 🧭 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/query_win_rate` | 查询 OP.GG 英雄排行数据 |
| `GET` | `/query_cn_win_rate` | 查询 101.qq.com 英雄排行数据 |
| `GET` | `/query_champion_detail` | 查询英雄详情、对位、符文、出装等数据 |
| `GET` | `/query_pro_leagues` | 查询职业赛区 |
| `GET` | `/query_pro_schedule` | 查询职业赛程 |
| `GET` | `/query_pro_match_detail` | 查询比赛详情 |
| `GET` | `/query_team_stats` | 查询战队统计 |
| `GET` | `/query_team_detail` | 查询战队详情 |
| `GET` | `/query_player` | 查询选手列表 |
| `GET` | `/query_player_detail` | 查询选手详情 |
| `POST` | `/predict` | 阵容胜率预测 |
| `POST` | `/predict_pro_match` | 职业比赛 BO 预测 |
| `POST` | `/predict_pro_game` | 单局小场预测与回测 |
| `GET/POST` | `/ai_prediction_config` | AI 提供商配置读取/保存 |
| `POST` | `/ai_prediction_test` | AI 提供商连通性测试 |
| `POST` | `/ai_prediction_analysis` | 非流式 AI 分析 |
| `POST` | `/ai_prediction_analysis_stream` | 流式 AI 分析 |
| `GET` | `/model_diagnostics` | 模型诊断信息 |

## 🤖 模型说明

原始模型是 BiLSTM-Attention，输入双方队伍与英雄 BP 特征后输出胜率。当前版本在原始输出上增加了校准逻辑：

- 阵容预测融合队伍强度、英雄分路胜率先验和模型输出。
- 职业 BO 预测融合 OP.GG/LPL 的战队近期统计。
- 小场预测按 BP 阵容给出赛前判断；如果比赛详情中已有击杀、经济、资源、时长等小场数据，会额外输出赛后校正和 `backtest`。

已结束比赛里可能出现“赛前预测错、赛后状态校正命中”的情况。这不是接口错误，而是赛前预测本来不能把最终比分当作输入。评估模型时需要区分：

- 赛前预测：只允许使用赛前队伍、版本、历史表现和 BP 信息。
- 赛后回测：允许使用比赛详情中的实际局内结果和统计。

当前模型仍存在过拟合和校准不足风险。后续训练应增加版本、赛区、选手状态、蓝红方、英雄交互、队伍近期强度、小场细节等特征，并按赛季/版本切分验证集，避免随机切分导致虚高表现。

## ☁️ 部署

### 方案 A：Vercel / Netlify 前端 + Render / Northflank 后端

这是最推荐的生产形态：前端走静态托管，FastAPI 后端部署到支持常驻 Python 进程的平台。

前端：

1. 在 Vercel 或 Netlify 导入仓库。
2. Root Directory 选择 `frontend`。
3. Build Command 使用 `npm run build`。
4. Output Directory 使用 `out`。
5. 配置 `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`。

后端：

1. 在 Render、Northflank、Fly.io、Koyeb、Railway 或 VPS 上创建 Python 服务。
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `python -m api.app`
4. 配置 `PORT=7777`、`MODEL_URL`、`MYSQL_URL` 和 AI 相关变量。
5. 如果平台自动注入 `PORT`，以后端平台注入值为准。

### 方案 B：EdgeOne Pages / EdgeOne 全栈

EdgeOne Pages 可以承载前端静态页面，也支持边缘函数和全栈框架能力。对本项目来说，有两种用法：

- 只部署 `frontend` 到 EdgeOne Pages，FastAPI 后端仍放在 Render / Northflank / VPS。
- 尝试全栈部署，把静态前端和轻量 API 放到 EdgeOne；如果 PyTorch、模型下载或源站同步导致包体、冷启动、运行时限制过高，则拆回常驻后端。

EdgeOne 环境中建议：

1. Root Directory 选择 `frontend`。
2. Build Command 使用 `npm run build`。
3. Output Directory 使用 `out`。
4. 配置 `NEXT_PUBLIC_API_BASE_URL` 指向 FastAPI 后端。
5. 如果尝试全栈，请确认运行时支持 Python 依赖体积、模型文件下载和长时间源站请求。

### 方案 C：手动部署

```bash
git clone git@github.com:Flames1217/LOL-DeepWinPredictor.git
cd LOL-DeepWinPredictor

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

cd frontend
npm install
npm run build
cd ..

set PORT=7777
python -m api.app
```

Linux / macOS:

```bash
export PORT=7777
python -m api.app
```

### 方案 D：Docker

```bash
docker build -t lol-deepwinpredictor .
docker run -p 7777:7777 \
  -e PORT=7777 \
  -e MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt \
  -e MYSQL_URL=mysql://user:password@host:3306/lol_deepwinpredictor?charset=utf8mb4 \
  lol-deepwinpredictor
```

## 🛠️ 开发命令

```bash
# 后端语法检查
python -m py_compile api/app.py api/ai_prediction.py api/model_storage.py

# 前端类型检查
cd frontend
npx tsc --noEmit

# 前端生产构建
npm run build

# 启动 FastAPI
cd ..
python -m api.app
```

## 🚢 发布流程

```bash
git status
python -m py_compile api/app.py api/ai_prediction.py api/model_storage.py
cd frontend
npx tsc --noEmit
npm run build
cd ..
git add <changed-files>
git commit -m "Release: describe change"
git push origin main
gh release create <tag> --title "<title>" --notes "<release notes>"
```

发布前确认不要提交：

- `.env.local`
- `data/json/ai_provider_config.json`
- `frontend/node_modules/`
- `frontend/.next/`
- 运行期抓取缓存和日志目录

## 🧩 维护注意

- OP.GG、101.qq.com、lpl.qq.com 的页面结构和接口可能变化，同步逻辑需要随源站维护。
- 如果源站有 WAF 或频率限制，优先做缓存、退避、代理和合规限频，不要在前端阻塞式反复请求。
- API Key、Cookie、Token 和代理凭据都不应提交到仓库。
- 本项目用于学习、研究和数据分析展示。使用第三方源站数据时，请遵守对应网站的服务条款。
- 模型预测结果不构成投注、投资或任何商业决策建议。

## 📄 License

本项目用于学习、研究和数据分析展示。模型预测结果不构成投注、投资或任何商业决策建议。
