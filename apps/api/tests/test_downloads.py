from datetime import UTC, datetime

import pytest

from app.engine import downloads
from app.engine.models import PhotoItem


def test_validate_download_url_rejects_non_https():
    with pytest.raises(ValueError):
        downloads.validate_download_url("http://photos.google.com/unsafe", ["photos.google.com"])


def test_validate_download_url_rejects_private_ip():
    with pytest.raises(ValueError):
        downloads.validate_download_url("https://127.0.0.1/metadata", ["photos.google.com"])


def test_validate_download_url_allows_google_host(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(downloads, "_reject_private_addresses", lambda _: None)
    downloads.validate_download_url("https://photos.google.com/lr/abc", ["photos.google.com"])


def test_validate_download_url_rejects_missing_hostname():
    with pytest.raises(ValueError):
        downloads.validate_download_url("https://", ["photos.google.com"])


def test_is_allowed_host_supports_exact_and_subdomains():
    assert downloads._is_allowed_host("photos.google.com", ["photos.google.com"])
    assert downloads._is_allowed_host("a.photos.google.com", ["photos.google.com"])
    assert not downloads._is_allowed_host("photos.google.com", [])


def test_reject_private_addresses_blocks_resolved_private_ip(monkeypatch: pytest.MonkeyPatch):
    def fake_getaddrinfo(_: str, __: int | None):
        return [(None, None, None, None, ("10.0.0.1", 0))]

    monkeypatch.setattr(downloads.socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(ValueError):
        downloads._reject_private_addresses("photos.google.com")


def test_download_manager_uses_default_fetcher_and_caches(monkeypatch: pytest.MonkeyPatch):
    calls: list[tuple[str, float, list[str], str]] = []

    def fake_fetcher(
        item: PhotoItem,
        *,
        headers: dict[str, str],
        timeout_seconds: float,
        allowed_hosts: list[str],
    ) -> bytes:
        calls.append((headers["X-Test"], timeout_seconds, allowed_hosts, item.id))
        return b"payload"

    monkeypatch.setattr(downloads, "_default_fetcher", fake_fetcher)
    manager = downloads.DownloadManager(
        headers={"X-Test": "ok"},
        timeout_seconds=12.5,
        allowed_hosts=["photos.google.com"],
    )
    item = PhotoItem(
        id="photo-1",
        create_time=datetime(2024, 1, 1, tzinfo=UTC),
        filename="photo.jpg",
        mime_type="image/jpeg",
        width=100,
        height=100,
        gps=None,
        download_url="https://photos.google.com/photo-1",
        deep_link=None,
    )

    assert manager.get_bytes(item) == b"payload"
    assert manager.get_bytes(item) == b"payload"
    assert manager.download_count == 1
    assert calls == [("ok", 12.5, ["photos.google.com"], "photo-1")]
