FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests

ENV PYTHONPATH=/app

EXPOSE 8002

CMD ["uvicorn", "app.main:asgi_app", "--host", "0.0.0.0", "--port", "8002"]
