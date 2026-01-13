from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Iterable
from uuid import uuid4

from app.core.config import Settings
from app.engine.candidates import build_candidate_sets
from app.engine.downloads import DownloadManager
from app.engine.grouping import SimilarityThresholds, group_exact_duplicates, group_near_duplicates
from app.engine.hashing import HashingService
from app.engine.models import PhotoItem
from app.engine.schemas import CostEstimate, ScanResult, StageMetrics


def run_scan(
    items: Iterable[PhotoItem],
    settings: Settings,
    download_manager: DownloadManager | None = None,
) -> ScanResult:
    run_id = uuid4().hex
    photo_items = list(items)
    download_manager = download_manager or DownloadManager(
        allowed_hosts=settings.scan_allowed_download_hosts
    )
    hashing_service = HashingService(download_manager)
    timings: dict[str, float] = {}
    counts: dict[str, int] = {"selected_images": len(photo_items)}

    start = time.perf_counter()
    candidate_sets = build_candidate_sets(photo_items)
    timings["candidate_narrowing_ms"] = _elapsed_ms(start)
    counts["candidate_sets"] = len(candidate_sets)
    counts["candidate_items"] = sum(len(group) for group in candidate_sets)

    start = time.perf_counter()
    byte_hashes: dict[str, str] = {}
    for item in photo_items:
        if item.download_url is None:
            continue
        byte_hashes[item.id] = hashing_service.get_byte_hash(item)
    timings["byte_hashing_ms"] = _elapsed_ms(start)
    counts["byte_hashes"] = hashing_service.byte_hash_count

    start = time.perf_counter()
    groups_exact = group_exact_duplicates(photo_items, byte_hashes)
    timings["exact_grouping_ms"] = _elapsed_ms(start)

    exact_hash_counts: dict[str, int] = defaultdict(int)
    for digest in byte_hashes.values():
        exact_hash_counts[digest] += 1
    exact_duplicate_ids = {
        item_id for item_id, digest in byte_hashes.items() if exact_hash_counts[digest] >= 2
    }

    hashable_candidate_sets = [
        [
            item
            for item in group
            if item.download_url is not None and item.id not in exact_duplicate_ids
        ]
        for group in candidate_sets
    ]
    hashable_candidate_sets = [group for group in hashable_candidate_sets if len(group) >= 2]

    start = time.perf_counter()
    perceptual_hashes = {
        item.id: hashing_service.get_perceptual_hashes(item)
        for group in hashable_candidate_sets
        for item in group
    }
    thresholds = SimilarityThresholds(
        dhash_very=settings.scan_dhash_threshold_very,
        dhash_possible=settings.scan_dhash_threshold_possible,
        phash_very=settings.scan_phash_threshold_very,
        phash_possible=settings.scan_phash_threshold_possible,
    )
    groups_very, groups_possible, comparisons = group_near_duplicates(
        hashable_candidate_sets,
        perceptual_hashes,
        thresholds,
    )
    timings["perceptual_hashing_ms"] = _elapsed_ms(start)
    counts["perceptual_hashes"] = hashing_service.perceptual_hash_count
    counts["comparisons_executed"] = comparisons
    counts["downloads_performed"] = download_manager.download_count

    stage_metrics = StageMetrics(
        timingsMs=timings,
        counts=counts,
    )
    cost_estimate = _estimate_costs(settings, counts)
    return ScanResult(
        runId=run_id,
        inputCount=len(photo_items),
        stageMetrics=stage_metrics,
        costEstimate=cost_estimate,
        groupsExact=groups_exact,
        groupsVerySimilar=groups_very,
        groupsPossiblySimilar=groups_possible,
    )


def _estimate_costs(settings: Settings, counts: dict[str, int]) -> CostEstimate:
    download_cost = counts.get("downloads_performed", 0) * settings.scan_cost_per_download
    hash_cost = (
        counts.get("byte_hashes", 0) * settings.scan_cost_per_byte_hash
        + counts.get("perceptual_hashes", 0) * settings.scan_cost_per_perceptual_hash
    )
    comparison_cost = counts.get("comparisons_executed", 0) * settings.scan_cost_per_comparison
    total_cost = download_cost + hash_cost + comparison_cost
    return CostEstimate(
        totalCost=round(total_cost, 6),
        downloadCost=round(download_cost, 6),
        hashCost=round(hash_cost, 6),
        comparisonCost=round(comparison_cost, 6),
    )


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)
