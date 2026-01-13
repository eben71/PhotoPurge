from __future__ import annotations

import ipaddress
import socket
import urllib.request
from collections.abc import Callable
from urllib.parse import urlparse

from app.engine.models import PhotoItem


DownloadFetcher = Callable[[PhotoItem], bytes]


class DownloadManager:
    def __init__(
        self,
        fetcher: DownloadFetcher | None = None,
        headers: dict[str, str] | None = None,
        timeout_seconds: float = 30.0,
        allowed_hosts: list[str] | None = None,
    ) -> None:
        self._cache: dict[str, bytes] = {}
        self._fetcher = fetcher or _default_fetcher
        self._headers = headers or {}
        self._timeout_seconds = timeout_seconds
        self._allowed_hosts = allowed_hosts or []
        self.download_count = 0

    def get_bytes(self, item: PhotoItem) -> bytes:
        if item.id in self._cache:
            return self._cache[item.id]
        data = (
            self._fetcher(item)
            if self._fetcher is not _default_fetcher
            else _default_fetcher(
                item,
                headers=self._headers,
                timeout_seconds=self._timeout_seconds,
                allowed_hosts=self._allowed_hosts,
            )
        )
        self._cache[item.id] = data
        self.download_count += 1
        return data


def _default_fetcher(
    item: PhotoItem,
    *,
    headers: dict[str, str],
    timeout_seconds: float,
    allowed_hosts: list[str],
) -> bytes:
    if not item.download_url:
        raise ValueError(f"Photo item {item.id} missing download URL")
    validate_download_url(item.download_url, allowed_hosts)
    request = urllib.request.Request(item.download_url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read()


def validate_download_url(url: str, allowed_hosts: list[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Download URL must use https.")
    if not parsed.hostname:
        raise ValueError("Download URL is missing a hostname.")
    hostname = parsed.hostname.lower()
    if not _is_allowed_host(hostname, allowed_hosts):
        raise ValueError("Download URL host is not allowed.")
    _reject_private_addresses(hostname)


def _is_allowed_host(hostname: str, allowed_hosts: list[str]) -> bool:
    if not allowed_hosts:
        return False
    for allowed in allowed_hosts:
        allowed = allowed.lower()
        if hostname == allowed or hostname.endswith(f".{allowed}"):
            return True
    return False


def _reject_private_addresses(hostname: str) -> None:
    try:
        ip_address = ipaddress.ip_address(hostname)
        _raise_if_private(ip_address)
        return
    except ValueError:
        pass

    for result in socket.getaddrinfo(hostname, None):
        ip_str = result[4][0]
        ip_address = ipaddress.ip_address(ip_str)
        _raise_if_private(ip_address)


def _raise_if_private(ip_address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    if not ip_address.is_global:
        raise ValueError("Download URL resolves to a non-global address.")
