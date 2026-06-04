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

ENV PYTHONPATH=/app
ENV PORT=7777
ENV DEEPWIN_SERVICE_MODE=full

EXPOSE 7777

CMD ["python", "-m", "api.app"]
