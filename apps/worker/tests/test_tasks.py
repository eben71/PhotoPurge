from app.tasks import ping


def test_ping_task_importable():
    assert ping() == "pong"
