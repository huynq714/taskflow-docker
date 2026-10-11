FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/app/data/tasks.db

WORKDIR /app

# RUN 1: Create dedicated non-root runtime account.
RUN groupadd --system appgroup && useradd --system --gid appgroup --home-dir /app --no-create-home appuser

COPY requirements.txt ./
# RUN 2: Install dependencies at image build time.
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY templates/ ./templates/
COPY static/ ./static/
COPY docker-entrypoint.sh ./

# RUN 3: Prepare persistent storage directory and assign ownership.
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

# RUN 4: Restrict script permissions and allow execution.
RUN chmod 755 /app/docker-entrypoint.sh && chmod 750 /app/data

USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--access-logfile", "-", "app:app"]
