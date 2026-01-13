from __future__ import annotations

from datetime import UTC, datetime

from app.core.config import Settings
from app.engine import scan
from app.engine.downloads import DownloadManager
from app.engine.hashing import HashingService, PerceptualHashes
from app.engine.models import PhotoItem


def test_run_scan_tracks_counts_and_costs(monkeypatch):
    items = [
        _photo_item("one", "https://photos.google.com/one"),
        _photo_item("two", "https://photos.google.com/two"),
    ]
    downloader = DownloadManager(fetcher=lambda item: item.id.encode())

    def fake_candidate_sets(_items):
        return [_items]

    def fake_near_duplicates(*_args, **_kwargs):
        return ([], [], 1)

    def fake_perceptual_hashes(self: HashingService, _item: PhotoItem) -> PerceptualHashes:
        self.perceptual_hash_count += 1
        return PerceptualHashes(dhash=0, phash=0)

    monkeypatch.setattr(scan, "build_candidate_sets", fake_candidate_sets)
    monkeypatch.setattr(scan, "group_near_duplicates", fake_near_duplicates)
    monkeypatch.setattr(HashingService, "get_perceptual_hashes", fake_perceptual_hashes)

    result = scan.run_scan(items, Settings(), download_manager=downloader)

    counts = result.stage_metrics.counts
    assert counts["selected_images"] == 2
    assert counts["candidate_sets"] == 1
    assert counts["candidate_items"] == 2
    assert counts["byte_hashes"] == 2
    assert counts["perceptual_hashes"] == 2
    assert counts["comparisons_executed"] == 1
    assert counts["downloads_performed"] == 2
    assert result.groups_exact == []
    assert result.groups_very_similar == []
    assert result.groups_possibly_similar == []

    costs = result.cost_estimate
    expected_download = 2 * Settings().scan_cost_per_download
    expected_hash = (
        2 * Settings().scan_cost_per_byte_hash + 2 * Settings().scan_cost_per_perceptual_hash
    )
    expected_comparison = 1 * Settings().scan_cost_per_comparison
    expected_total = expected_download + expected_hash + expected_comparison
    assert costs.download_cost == round(expected_download, 6)
    assert costs.hash_cost == round(expected_hash, 6)
    assert costs.comparison_cost == round(expected_comparison, 6)
    assert costs.total_cost == round(expected_total, 6)


def _photo_item(item_id: str, download_url: str | None) -> PhotoItem:
    return PhotoItem(
        id=item_id,
        create_time=datetime(2024, 1, 1, tzinfo=UTC),
        filename=f"{item_id}.jpg",
        mime_type="image/jpeg",
        width=100,
        height=100,
        gps=None,
        download_url=download_url,
        deep_link=None,
    )
