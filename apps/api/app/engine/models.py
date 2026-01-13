from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class GPSLocation:
    latitude: float
    longitude: float


@dataclass(frozen=True)
class PhotoItem:
    id: str
    create_time: datetime
    filename: str | None
    mime_type: str | None
    width: int | None
    height: int | None
    gps: GPSLocation | None
    download_url: str | None
    deep_link: str | None
