from celery import shared_task


@shared_task(name="tasks.ping")
def ping() -> str:
    return "pong"
