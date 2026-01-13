from __future__ import annotations

import pytest

from app.engine import downloads


def test_validate_download_url_rejects_non_https():
    with pytest.raises(ValueError):
        downloads.validate_download_url("http://photos.google.com/unsafe", ["photos.google.com"])


def test_validate_download_url_rejects_private_ip():
    with pytest.raises(ValueError):
        downloads.validate_download_url("https://127.0.0.1/metadata", ["photos.google.com"])


def test_validate_download_url_allows_google_host(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(downloads, "_reject_private_addresses", lambda _: None)
    downloads.validate_download_url("https://photos.google.com/lr/abc", ["photos.google.com"])
