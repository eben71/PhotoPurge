from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.config import Settings
from app.engine.candidates import build_candidate_sets
from app.engine.downloads import DownloadManager
from app.engine.grouping import (
    SimilarityThresholds,
    group_exact_duplicates,
    group_near_duplicates,
    select_representative_pair,
)
from app.engine.hashing import HashingService, PerceptualHashes
from app.engine.models import PhotoItem


def test_candidate_narrowing_is_deterministic():
    base_time = datetime(2024, 1, 1, tzinfo=UTC)
    items = [
        _photo_item("a", base_time, 4000, 3000),
        _photo_item("b", base_time + timedelta(minutes=5), 4000, 3000),
        _photo_item("c", base_time + timedelta(days=1), 1000, 2000),
    ]

    first = build_candidate_sets(items)
    second = build_candidate_sets(items)

    assert [[item.id for item in group] for group in first] == [
        [item.id for item in group] for group in second
    ]


def test_exact_duplicate_grouping():
    image_bytes = _make_image_bytes()
    items = [
        _photo_item("dup1", datetime(2024, 1, 1, tzinfo=UTC), 120, 80),
        _photo_item("dup2", datetime(2024, 1, 1, tzinfo=UTC), 120, 80),
    ]
    download_map = {"dup1": image_bytes, "dup2": image_bytes}
    downloader = DownloadManager(fetcher=lambda item: download_map[item.id])
    hashing = HashingService(downloader)
    byte_hashes = {item.id: hashing.get_byte_hash(item) for item in items}

    groups = group_exact_duplicates(items, byte_hashes)

    assert len(groups) == 1
    assert [item.id for item in groups[0].items] == ["dup1", "dup2"]


def test_near_duplicate_grouping_is_very_similar(monkeypatch):
    png_bytes = _make_image_bytes()
    jpeg_bytes = _make_image_bytes()
    items = [
        _photo_item("near1", datetime(2024, 1, 1, tzinfo=UTC), 64, 64),
        _photo_item("near2", datetime(2024, 1, 1, tzinfo=UTC), 64, 64),
    ]
    download_map = {"near1": png_bytes, "near2": jpeg_bytes}
    downloader = DownloadManager(fetcher=lambda item: download_map[item.id])
    hashing = HashingService(downloader)

    def fake_perceptual_hashes(_: HashingService, __: PhotoItem) -> PerceptualHashes:
        return PerceptualHashes(dhash=0, phash=0)

    monkeypatch.setattr(HashingService, "get_perceptual_hashes", fake_perceptual_hashes)
    perceptual_hashes = {item.id: hashing.get_perceptual_hashes(item) for item in items}
    thresholds = SimilarityThresholds(
        dhash_very=Settings().scan_dhash_threshold_very,
        dhash_possible=Settings().scan_dhash_threshold_possible,
        phash_very=Settings().scan_phash_threshold_very,
        phash_possible=Settings().scan_phash_threshold_possible,
    )

    groups_very, groups_possible, comparisons = group_near_duplicates(
        [items],
        perceptual_hashes,
        thresholds,
    )

    assert comparisons == 1
    assert len(groups_very) == 1
    assert len(groups_possible) == 0
    assert [item.id for item in groups_very[0].items] == ["near1", "near2"]


def test_representative_pair_selection():
    base_time = datetime(2024, 1, 1, tzinfo=UTC)
    items = [
        _photo_item("alpha", base_time + timedelta(minutes=2), 100, 100),
        _photo_item("beta", base_time, 100, 100),
        _photo_item("gamma", base_time + timedelta(minutes=5), 100, 100),
    ]

    pair = select_representative_pair(items)

    assert pair.earliest.id == "beta"
    assert pair.latest.id == "gamma"


def _photo_item(item_id: str, create_time: datetime, width: int, height: int) -> PhotoItem:
    return PhotoItem(
        id=item_id,
        create_time=create_time,
        filename=f"{item_id}.jpg",
        mime_type="image/jpeg",
        width=width,
        height=height,
        gps=None,
        download_url="memory://",
        deep_link=None,
    )


def _make_image_bytes() -> bytes:
    return b"fake-image-bytes"
