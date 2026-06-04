FROM node:22-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build


FROM python:3.10-slim

RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

ARG REQUIREMENTS_FILE=requirements.txt
COPY --chown=user ./requirements.txt requirements.txt
COPY --chown=user ./requirements-lite.txt requirements-lite.txt
RUN pip install --no-cache-dir --upgrade -r "${REQUIREMENTS_FILE}"

COPY --chown=user . /app
COPY --from=frontend-build --chown=user /app/frontend/out /app/frontend/out

ENV PYTHONPATH=/app
ENV PORT=7777
ENV DEEPWIN_SERVICE_MODE=full
ENV HF_HOME=/tmp/huggingface
ENV XDG_CACHE_HOME=/tmp/.cache

EXPOSE 7777

CMD ["python", "-m", "api.app"]
