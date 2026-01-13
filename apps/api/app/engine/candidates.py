from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from app.engine.models import PhotoItem


def build_candidate_sets(items: Sequence[PhotoItem]) -> list[list[PhotoItem]]:
    buckets: dict[str, list[PhotoItem]] = defaultdict(list)
    for item in items:
        buckets[_bucket_key(item)].append(item)
    candidate_sets: list[list[PhotoItem]] = []
    for key in sorted(buckets.keys()):
        bucket_items = sorted(
            buckets[key],
            key=lambda entry: (entry.create_time, entry.id),
        )
        if len(bucket_items) >= 2:
            candidate_sets.append(bucket_items)
    return candidate_sets


def _bucket_key(item: PhotoItem) -> str:
    date_key = item.create_time.date().isoformat()
    ratio_key = _aspect_ratio_class(item.width, item.height)
    resolution_key = _resolution_bucket(item.width, item.height)
    return f"{date_key}:{ratio_key}:{resolution_key}"


def _aspect_ratio_class(width: int | None, height: int | None) -> str:
    if not width or not height:
        return "unknown"
    ratio = width / height
    if ratio >= 1.2:
        return "landscape"
    if ratio <= 0.8:
        return "portrait"
    return "square"


def _resolution_bucket(width: int | None, height: int | None) -> str:
    if not width or not height:
        return "unknown"
    megapixels = int((width * height) / 1_000_000)
    return f"{megapixels}mp"
