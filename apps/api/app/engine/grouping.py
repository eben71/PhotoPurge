from __future__ import annotations

import hashlib
from collections import defaultdict, deque
from dataclasses import dataclass

from app.engine.hashing import PerceptualHashes, hamming_distance
from app.engine.models import PhotoItem
from app.engine.schemas import GroupRepresentativePair, GroupResult, PhotoItemSummary


@dataclass(frozen=True)
class SimilarityThresholds:
    dhash_very: int
    dhash_possible: int
    phash_very: int
    phash_possible: int


def group_exact_duplicates(
    items: list[PhotoItem],
    byte_hashes: dict[str, str],
) -> list[GroupResult]:
    buckets: dict[str, list[PhotoItem]] = defaultdict(list)
    for item in items:
        digest = byte_hashes.get(item.id)
        if digest:
            buckets[digest].append(item)
    return _build_groups(
        [
            sorted(bucket, key=lambda entry: (entry.create_time, entry.id))
            for bucket in buckets.values()
            if len(bucket) >= 2
        ],
        category="EXACT",
        explanation="Byte-identical content (SHA-256 match).",
    )


def group_near_duplicates(
    candidate_sets: list[list[PhotoItem]],
    perceptual_hashes: dict[str, PerceptualHashes],
    thresholds: SimilarityThresholds,
) -> tuple[list[GroupResult], list[GroupResult], int]:
    comparisons = 0
    edges_very: dict[str, set[str]] = defaultdict(set)
    edges_possible: dict[str, set[str]] = defaultdict(set)
    seen_pairs: set[tuple[str, str]] = set()
    id_to_item: dict[str, PhotoItem] = {
        item.id: item for candidate in candidate_sets for item in candidate
    }
    for candidates in candidate_sets:
        for i, left in enumerate(candidates):
            for right in candidates[i + 1 :]:
                pair = (left.id, right.id) if left.id < right.id else (right.id, left.id)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                comparisons += 1
                left_hashes = perceptual_hashes[left.id]
                right_hashes = perceptual_hashes[right.id]
                dhash_distance = hamming_distance(left_hashes.dhash, right_hashes.dhash)
                phash_distance = hamming_distance(left_hashes.phash, right_hashes.phash)
                if dhash_distance <= thresholds.dhash_very or phash_distance <= thresholds.phash_very:
                    _add_edge(edges_very, left.id, right.id)
                elif (
                    dhash_distance <= thresholds.dhash_possible
                    or phash_distance <= thresholds.phash_possible
                ):
                    _add_edge(edges_possible, left.id, right.id)
    very_groups, very_ids = _connected_components(edges_very, id_to_item)
    possible_groups, _ = _connected_components(
        edges_possible,
        id_to_item,
        exclude_ids=very_ids,
    )
    return (
        _build_groups(very_groups, category="VERY_SIMILAR", explanation=_explain(thresholds, True)),
        _build_groups(
            possible_groups,
            category="POSSIBLY_SIMILAR",
            explanation=_explain(thresholds, False),
        ),
        comparisons,
    )


def select_representative_pair(items: list[PhotoItem]) -> GroupRepresentativePair:
    ordered = sorted(items, key=lambda entry: (entry.create_time, entry.id))
    earliest = ordered[0]
    latest = ordered[-1]
    return GroupRepresentativePair(
        earliest=_to_summary(earliest),
        latest=_to_summary(latest),
    )


def _add_edge(edges: dict[str, set[str]], left: str, right: str) -> None:
    edges[left].add(right)
    edges[right].add(left)


def _connected_components(
    edges: dict[str, set[str]],
    id_to_item: dict[str, PhotoItem],
    *,
    exclude_ids: set[str] | None = None,
) -> tuple[list[list[PhotoItem]], set[str]]:
    visited: set[str] = set()
    exclude = exclude_ids or set()
    groups: list[list[PhotoItem]] = []
    grouped_ids: set[str] = set()
    for node in sorted(edges.keys()):
        if node in visited or node in exclude:
            continue
        queue = deque([node])
        visited.add(node)
        component_ids: list[str] = []
        while queue:
            current = queue.popleft()
            if current in exclude:
                continue
            component_ids.append(current)
            for neighbor in sorted(edges.get(current, set())):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if len(component_ids) >= 2:
            component_items = [
                id_to_item[item_id] for item_id in component_ids if item_id in id_to_item
            ]
            if len(component_items) >= 2:
                groups.append(component_items)
                grouped_ids.update(component_ids)
    return groups, grouped_ids


def _build_groups(
    groups: list[list[PhotoItem]],
    *,
    category: str,
    explanation: str,
) -> list[GroupResult]:
    results: list[GroupResult] = []
    for group in groups:
        ordered = sorted(group, key=lambda entry: (entry.create_time, entry.id))
        representative_pair = select_representative_pair(ordered)
        group_id = _stable_group_id(category, ordered)
        results.append(
            GroupResult(
                groupId=group_id,
                category=category,
                items=[_to_summary(item) for item in ordered],
                representativePair=representative_pair,
                moreCount=max(len(ordered) - 2, 0),
                explanation=explanation,
                googlePhotosDeepLinks=[
                    item.deep_link for item in ordered if item.deep_link is not None
                ],
            )
        )
    return results


def _stable_group_id(category: str, items: list[PhotoItem]) -> str:
    joined = "|".join(item.id for item in items)
    digest = hashlib.sha1(joined.encode("utf-8")).hexdigest()
    return f"{category.lower()}-{digest[:12]}"


def _to_summary(item: PhotoItem) -> PhotoItemSummary:
    return PhotoItemSummary(
        id=item.id,
        createTime=item.create_time,
        filename=item.filename,
        mimeType=item.mime_type,
        width=item.width,
        height=item.height,
        googlePhotosDeepLink=item.deep_link,
    )


def _explain(thresholds: SimilarityThresholds, very: bool) -> str:
    if very:
        return (
            "Perceptual hash match (dHash ≤ "
            f"{thresholds.dhash_very} or pHash ≤ {thresholds.phash_very})."
        )
    return (
        "Perceptual hash similarity (dHash ≤ "
        f"{thresholds.dhash_possible} or pHash ≤ {thresholds.phash_possible})."
    )
