import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

broker_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
backend_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "photoprune_worker",
    broker=broker_url,
    backend=backend_url,
)

app.conf.task_routes = {"tasks.ping": {"queue": "default"}}
