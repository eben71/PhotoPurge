from __future__ import annotations

import urllib.request
from collections.abc import Callable

from app.engine.models import PhotoItem


DownloadFetcher = Callable[[PhotoItem], bytes]


class DownloadManager:
    def __init__(
        self,
        fetcher: DownloadFetcher | None = None,
        headers: dict[str, str] | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._cache: dict[str, bytes] = {}
        self._fetcher = fetcher or _default_fetcher
        self._headers = headers or {}
        self._timeout_seconds = timeout_seconds
        self.download_count = 0

    def get_bytes(self, item: PhotoItem) -> bytes:
        if item.id in self._cache:
            return self._cache[item.id]
        data = self._fetcher(item) if self._fetcher is not _default_fetcher else _default_fetcher(
            item,
            headers=self._headers,
            timeout_seconds=self._timeout_seconds,
        )
        self._cache[item.id] = data
        self.download_count += 1
        return data


def _default_fetcher(
    item: PhotoItem,
    *,
    headers: dict[str, str],
    timeout_seconds: float,
) -> bytes:
    if not item.download_url:
        raise ValueError(f"Photo item {item.id} missing download URL")
    request = urllib.request.Request(item.download_url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read()
