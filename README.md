---
title: LOL-DeepWinPredictor
emoji: 🏆
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7777
---

# LOL-DeepWinPredictor

<p align="center">
  <img src="https://socialify.git.ci/Flames1217/LOL-DeepWinPredictor/image?description=1&font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating%20Cogs&pulls=1&stargazers=1&theme=Auto" alt="LOL-DeepWinPredictor" width="720">
</p>

<p>
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat&logo=pytorch&logoColor=white" alt="PyTorch">
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-087EA4?style=flat&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/Hugging_Face-FFD21E?style=flat&logo=huggingface&logoColor=111111" alt="Hugging Face">
</p>

LOL-DeepWinPredictor 是一个英雄联盟职业赛事数据分析与胜率预测项目。它把实时数据接口、职业赛程、BP 阵容、AI 分析和本地 BiLSTM-Attention 推理整合到一个可部署的 Web 应用里。

## ✨ 功能

| 模块 | 能力 |
| --- | --- |
| 胜率预测 | 蓝红方队伍、分路英雄、Ban 位、校准胜率、AI 流式解释 |
| 英雄数据 | 分路、段位、版本、登场率、禁用率、胜率、对位、符文、出装、技能 |
| 战队数据 | 赛区战队、胜负、KDA、经济、资源控制、近期比赛、后续赛程 |
| 选手数据 | 选手列表、队伍、位置、头像、KDA、DPM、GPM、参团率、常用英雄 |
| 职业赛程 | 多赛区赛程、日期筛选、倒计时、比分、比赛详情、AI 预测 |
| AI 提供商 | OpenAI Compatible Base URL、API Key、模型名、连接测试、流式分析 |
| 模型实验室 | 服务模式、模型状态、输入维度、校准策略、已知风险、训练路线 |

## 🔌 数据源

| 来源 | 用途 |
| --- | --- |
| <img src="https://www.op.gg/favicon.ico" width="18" style="vertical-align:-4px" alt="OP.GG"> OP.GG | 英雄排行榜、对位、符文、出装、召唤师技能 |
| <img src="https://esports.op.gg/favicon.ico" width="18" style="vertical-align:-4px" alt="OP.GG Esports"> OP.GG Esports | 职业赛区、战队、选手、赛程、比赛详情 |
| <img src="https://101.qq.com/favicon.ico" width="18" style="vertical-align:-4px" alt="101.qq.com"> 101.qq.com | 国服英雄数据、段位/分路排行 |
| <img src="https://lpl.qq.com/favicon.ico" width="18" style="vertical-align:-4px" alt="LPL"> lpl.qq.com | LPL 赛程、比分、比赛详情、小场数据 |

## 🧱 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js 静态导出、React、TypeScript、Tailwind CSS、Radix UI |
| 后端 | FastAPI、Uvicorn、Python |
| 模型 | PyTorch、BiLSTM-Attention |
| 数据 | OP.GG、OP.GG Esports、101.qq.com、lpl.qq.com |
| 缓存 | 本地运行期缓存；MySQL 仅用于访问统计 |
| AI | OpenAI Compatible API，支持自定义 Base URL、API Key 和模型 |

## 📁 项目结构

```text
.
├── api/
│   ├── app.py                 # FastAPI 入口，按服务模式加载数据接口或模型推理
│   ├── ai_prediction.py       # AI 提供商配置、连接测试、流式/非流式分析
│   └── model_storage.py       # 本地模型与 MODEL_URL 远程模型加载
├── BILSTM_Att/                # BiLSTM-Attention 模型、训练、评估脚本
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
├── data/json/                 # 运行期缓存目录
├── static/saved_model/        # 默认本地模型目录
├── requirements.txt           # 完整服务依赖
├── requirements-lite.txt      # 轻量服务依赖，不含 torch
├── Dockerfile
└── README.md
```

## 🚀 快速开始

| 步骤 | 命令 |
| --- | --- |
| 创建环境 | `python -m venv venv` |
| 激活环境 | Windows: `venv\Scripts\activate`；macOS/Linux: `source venv/bin/activate` |
| 安装后端 | `pip install -r requirements.txt` |
| 构建前端 | `cd frontend && npm install && npm run build && cd ..` |
| 启动服务 | `python -m api.app` |
| 访问页面 | `http://127.0.0.1:7777` |
| API 文档 | `http://127.0.0.1:7777/docs` |

## 🔐 环境变量

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| `HOST` | FastAPI 监听地址，默认 `0.0.0.0` | 否 |
| `PORT` | FastAPI 端口，默认 `7777` | 否 |
| `DEEPWIN_SERVICE_MODE` | `full`、`lite`、`model`，默认 `full` | 否 |
| `MYSQL_URL` | MySQL 连接字符串，仅用于站点访问统计 | 否 |
| `MODEL_URL` | 远程模型文件地址，支持 HTTPS、WebDAV HTTPS、公开 `s3://bucket/key`、S3/R2/OSS 预签名 HTTPS | 否 |
| `AI_PROVIDER` | AI 提供商，例如 `openai-compatible`、`openai`、`ollama` | 否 |
| `AI_BASE_URL` | OpenAI Compatible Base URL | 否 |
| `AI_API_KEY` | AI API Key | 否 |
| `AI_MODEL` | AI 模型名 | 否 |
| `NEXT_PUBLIC_API_BASE_URL` | 前端访问数据 API 的域名 | 否 |
| `NEXT_PUBLIC_MODEL_API_BASE_URL` | 前端访问预测模型 API 的域名；留空时跟随数据 API | 否 |
| `PROXIES` | 请求外部源站时使用的代理 | 否 |

最小示例：

```bash
HOST=0.0.0.0
PORT=7777
DEEPWIN_SERVICE_MODE=full
MYSQL_URL=mysql://user:password@127.0.0.1:3306/lol_deepwinpredictor?charset=utf8mb4
MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_MODEL_API_BASE_URL=https://model-api.example.com
```

## 🧩 服务模式

| 模式 | 依赖 | 适合场景 | 预测接口 |
| --- | --- | --- | --- |
| `full` | `requirements.txt` | 一套后端跑完整站点 | 可用 |
| `lite` | `requirements-lite.txt` | 只部署数据、赛程、AI、统计接口 | 返回 503 |
| `model` | `requirements.txt` | 单独承载预测接口 | 可用 |

## ☁️ 部署

### 方案 A：Hugging Face Spaces

| 配置 | 推荐值 |
| --- | --- |
| Space SDK | Docker |
| 端口 | `7777` |
| Dockerfile | 使用仓库根目录的 `Dockerfile` |
| 完整服务 | `DEEPWIN_SERVICE_MODE=full` |
| 轻量服务 | `DEEPWIN_SERVICE_MODE=lite` + Docker build arg `REQUIREMENTS_FILE=requirements-lite.txt` |

Hugging Face Space 的运行时配置：

| 名称 | 放置位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `DEEPWIN_SERVICE_MODE` | Variable | 否 | 服务模式，默认 `full`；轻量部署填 `lite` |
| `PORT` | Variable | 否 | 服务端口，默认 `7777` |
| `MODEL_URL` | Variable 或 Secret | 否 | 远程模型地址，支持 HTTPS、WebDAV HTTPS、公开 `s3://bucket/key`、S3/R2/OSS 预签名 HTTPS；仓库内已有模型时可留空 |
| `MYSQL_URL` | Secret | 否 | MySQL 连接字符串，仅用于站点访问统计 |
| `AI_PROVIDER` | Variable | 否 | AI 提供商，例如 `openai-compatible`、`openai`、`ollama` |
| `AI_BASE_URL` | Variable | 否 | OpenAI Compatible Base URL |
| `AI_API_KEY` | Secret | 否 | AI API Key |
| `AI_MODEL` | Variable | 否 | AI 模型名 |
| `PROXIES` | Secret | 否 | 访问 OP.GG、101.qq.com、lpl.qq.com 等源站时使用的代理 |

最小可运行配置：

| 场景 | 建议 |
| --- | --- |
| 只跑页面和实时数据接口 | 不填也能启动，访问统计、远程模型和 AI 分析会自动降级 |
| 需要访问统计 | 配置 `MYSQL_URL` |
| 需要远程模型 | 配置 `MODEL_URL` |
| 需要 AI 分析 | 配置 `AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` |

注意：`HF_TOKEN`、`HF_SPACE_ID`、`OPENROUTER_API_KEY` 是 GitHub Actions 使用的配置，不要填到 Hugging Face Space 运行时变量里。

### GitHub 自动同步到 Hugging Face

已提供 `.github/workflows/sync-huggingface.yml`。每次 `main` 分支更新后，GitHub Actions 会把仓库镜像推送到 Hugging Face Space。

| GitHub 配置 | 值 |
| --- | --- |
| Secret `HF_TOKEN` | Hugging Face Access Token，需要对目标 Space 有写入权限 |
| Variable 或 Secret `HF_SPACE_ID` | Hugging Face Space ID，例如 `username/LOL-DeepWinPredictor` |

流程：

1. GitHub 推送到 `main`。
2. Actions 生成 Hugging Face 部署目录，只包含运行所需的后端、前端源码、Dockerfile、依赖文件和 README。
3. Actions 排除本地缓存、构建产物、日志、临时文件和训练缓存。
4. Actions 将图片、字体、模型等二进制资源按 Git LFS/Xet 方式提交，避免 Hugging Face 拒绝普通二进制推送。
5. Actions 推送部署目录到 `https://huggingface.co/spaces/${HF_SPACE_ID}` 的 `main` 分支。
6. Hugging Face Space 收到更新后自动重新构建 Docker 镜像。

### GitHub 自动发布 Release

已保留 `.github/workflows/release.yml`。每次 `main` 分支更新后，GitHub Actions 会基于本次提交差异生成中文 Release Notes，并创建新的 GitHub Release。

| GitHub 配置 | 值 |
| --- | --- |
| Secret `OPENROUTER_API_KEY` | 用于调用 OpenRouter 生成 Release Notes |
| `GITHUB_TOKEN` | GitHub Actions 内置 Token，无需手动创建 |

说明：

1. `OPENROUTER_API_KEY` 只给 GitHub Actions 使用，不需要配置到 Hugging Face Space 或本地运行环境。
2. 如果之后不想每次推送 `main` 都自动发布 Release，可以停用或删除 `.github/workflows/release.yml`，再删除这个 Secret。
3. Release 失败不会影响 Hugging Face Space 同步；两个 workflow 是独立的。

### 方案 B：手动部署

| 目标 | 命令 |
| --- | --- |
| 完整服务依赖 | `pip install -r requirements.txt` |
| 轻量服务依赖 | `pip install -r requirements-lite.txt` |
| 构建前端 | `cd frontend && npm install && npm run build && cd ..` |
| 启动完整服务 | `set DEEPWIN_SERVICE_MODE=full && python -m api.app` |
| 启动轻量服务 | `set DEEPWIN_SERVICE_MODE=lite && python -m api.app` |

macOS / Linux 把 `set` 换成 `export`。

### 方案 C：Docker 部署

完整服务：

```bash
docker build -t lol-deepwinpredictor .
docker run -p 7777:7777 \
  -e PORT=7777 \
  -e DEEPWIN_SERVICE_MODE=full \
  -e MODEL_URL=https://cdn.example.com/models/BILSTM_Att.pt \
  -e MYSQL_URL=mysql://user:password@host:3306/lol_deepwinpredictor?charset=utf8mb4 \
  lol-deepwinpredictor
```

轻量服务：

```bash
docker build --build-arg REQUIREMENTS_FILE=requirements-lite.txt -t lol-deepwinpredictor-lite .
docker run -p 7777:7777 \
  -e PORT=7777 \
  -e DEEPWIN_SERVICE_MODE=lite \
  -e MYSQL_URL=mysql://user:password@host:3306/lol_deepwinpredictor?charset=utf8mb4 \
  lol-deepwinpredictor-lite
```

## 🧪 检查命令

| 检查 | 命令 |
| --- | --- |
| 后端语法 | `python -m py_compile api/app.py api/ai_prediction.py api/model_storage.py` |
| 前端类型 | `cd frontend && npx tsc --noEmit` |
| 前端构建 | `cd frontend && npm run build` |
| 轻量模式 | `DEEPWIN_SERVICE_MODE=lite python -m api.app` |
| 完整模式 | `DEEPWIN_SERVICE_MODE=full python -m api.app` |

## 🤖 模型说明

| 项目 | 说明 |
| --- | --- |
| 原始模型 | BiLSTM-Attention |
| 输入 | 队伍、分路、英雄、BP、源站统计先验 |
| 输出 | 蓝红方胜率、校准概率、置信度 |
| 校准 | 融合模型输出、队伍强度、英雄分路胜率先验 |
| 风险 | 当前模型仍存在过拟合和校准不足 |
| 后续 | 增加版本、赛区、选手状态、蓝红方、英雄交互、近期队伍强度、小场细节等特征 |

## ⚠️ 实时比赛预测

| 结论 | 原因 |
| --- | --- |
| 暂不做自动实时胜率曲线 | 公开页面通常只有赛前信息或赛后统计，没有稳定、连续、低延迟的局内事件流 |
| 不把直播预测曲线当作可复刻接口 | 直播中的商业实时预测多来自赛事方、转播方或数据商内部通道 |
| 后续重点 | 赛前预测、BP 后预测、职业赛程预测、小场预测/回测、模型校准 |

## 🧭 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/query_win_rate` | OP.GG 英雄排行榜 |
| `GET` | `/query_cn_win_rate` | 101.qq.com 英雄排行榜 |
| `GET` | `/query_champion_detail` | 英雄详情、对位、符文、出装 |
| `GET` | `/query_team_stats` | 战队统计 |
| `GET` | `/query_team_detail` | 战队详情 |
| `GET` | `/query_player` | 选手列表 |
| `GET` | `/query_player_detail` | 选手详情 |
| `GET` | `/query_pro_leagues` | 职业赛区 |
| `GET` | `/query_pro_schedule` | 职业赛程 |
| `GET` | `/query_pro_match_detail` | 比赛详情 |
| `POST` | `/predict` | 阵容胜率预测 |
| `POST` | `/predict_pro_match` | 职业比赛 BO 预测 |
| `POST` | `/predict_pro_game` | 单局小场预测与回测 |
| `GET/POST` | `/ai_prediction_config` | AI 提供商配置 |
| `POST` | `/ai_prediction_analysis_stream` | 流式 AI 分析 |
| `GET` | `/model_diagnostics` | 模型诊断 |

## 🧩 维护注意

| 事项 | 建议 |
| --- | --- |
| 源站结构变化 | 同步逻辑需要跟随 OP.GG、101.qq.com、lpl.qq.com 维护 |
| WAF / 频率限制 | 优先使用缓存、退避、代理和合规限频 |
| 密钥 | 不提交 API Key、Cookie、Token、代理凭据 |
| 缓存 | 不提交运行期抓取缓存、日志和本地配置 |
| 预测结果 | 仅用于学习、研究和数据分析展示，不构成投注、投资或商业决策建议 |

## 📄 License

本项目用于学习、研究和数据分析展示。模型预测结果不构成投注、投资或任何商业决策建议。
