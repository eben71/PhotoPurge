from collections.abc import Callable
from typing import Any, TypeVar, cast

from celery import shared_task  # type: ignore[import-untyped]

ReturnType = TypeVar("ReturnType")


def typed_task(
    *args: Any, **kwargs: Any
) -> Callable[[Callable[..., ReturnType]], Callable[..., ReturnType]]:
    """Cast Celery's shared_task decorator to preserve the wrapped function's typing."""
    return cast(
        Callable[[Callable[..., ReturnType]], Callable[..., ReturnType]],
        shared_task(*args, **kwargs),
    )


@typed_task(name="tasks.ping")
def ping() -> str:
    return "pong"
