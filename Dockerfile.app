FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.app.txt .
RUN pip install --no-cache-dir -r requirements.app.txt

COPY app.py .
COPY saved_models/ ./saved_models/
COPY Synthetic_Financial_datasets_log.csv .

EXPOSE 8000

CMD ["python", "app.py"]
