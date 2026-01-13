from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from app.engine.models import GPSLocation, PhotoItem
from app.engine.schemas import PhotoItemPayload


def normalize_photo_items(items: Iterable[PhotoItemPayload]) -> list[PhotoItem]:
    return [
        PhotoItem(
            id=item.id,
            create_time=item.create_time,
            filename=item.filename,
            mime_type=item.mime_type,
            width=item.width,
            height=item.height,
            gps=_build_gps(item.gps_latitude, item.gps_longitude),
            download_url=item.download_url,
            deep_link=item.deep_link,
        )
        for item in items
    ]


def normalize_picker_payload(payload: dict[str, Any]) -> list[PhotoItem]:
    raw_items = _extract_picker_items(payload)
    normalized: list[PhotoItem] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        item_id = _get_first_value(item, ("id",), ("mediaFile", "id"))
        create_time_raw = _get_first_value(
            item,
            ("createTime",),
            ("mediaFile", "createTime"),
            ("mediaFile", "mediaFileMetadata", "creationTime"),
        )
        if not item_id or not create_time_raw:
            continue
        create_time = _parse_datetime(create_time_raw)
        normalized.append(
            PhotoItem(
                id=str(item_id),
                create_time=create_time,
                filename=_get_first_value(item, ("filename",), ("mediaFile", "filename")),
                mime_type=_get_first_value(item, ("mimeType",), ("mediaFile", "mimeType")),
                width=_coerce_int(
                    _get_first_value(
                        item,
                        ("width",),
                        ("mediaFile", "width"),
                        ("mediaFile", "mediaFileMetadata", "width"),
                    )
                ),
                height=_coerce_int(
                    _get_first_value(
                        item,
                        ("height",),
                        ("mediaFile", "height"),
                        ("mediaFile", "mediaFileMetadata", "height"),
                    )
                ),
                gps=_extract_gps(item),
                download_url=_get_first_value(item, ("baseUrl",), ("mediaFile", "baseUrl")),
                deep_link=_get_first_value(item, ("productUrl",), ("mediaFile", "productUrl")),
            )
        )
    return normalized


def _extract_picker_items(payload: dict[str, Any]) -> list[Any]:
    items = payload.get("mediaItems") or payload.get("items") or payload.get("media_items")
    if isinstance(items, list):
        return items
    return []


def _get_first_value(item: dict[str, Any], *paths: tuple[str, ...]) -> str | None:
    for path in paths:
        cursor: Any = item
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = None
                break
            cursor = cursor[key]
        if cursor is not None:
            return str(cursor)
    return None


def _parse_datetime(value: str) -> datetime:
    cleaned = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        return datetime.fromtimestamp(0, tz=UTC)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _coerce_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _build_gps(latitude: float | None, longitude: float | None) -> GPSLocation | None:
    if latitude is None or longitude is None:
        return None
    return GPSLocation(latitude=latitude, longitude=longitude)


def _extract_gps(item: dict[str, Any]) -> GPSLocation | None:
    latitude_raw = _get_first_value(
        item,
        ("mediaFile", "mediaFileMetadata", "location", "latitude"),
        ("location", "latitude"),
    )
    longitude_raw = _get_first_value(
        item,
        ("mediaFile", "mediaFileMetadata", "location", "longitude"),
        ("location", "longitude"),
    )
    try:
        latitude = float(latitude_raw) if latitude_raw is not None else None
        longitude = float(longitude_raw) if longitude_raw is not None else None
    except ValueError:
        return None
    return _build_gps(latitude, longitude)
