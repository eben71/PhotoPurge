from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PhotoItemPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    create_time: datetime = Field(alias="createTime")
    filename: str | None = None
    mime_type: str | None = Field(default=None, alias="mimeType")
    width: int | None = None
    height: int | None = None
    gps_latitude: float | None = Field(default=None, alias="gpsLatitude")
    gps_longitude: float | None = Field(default=None, alias="gpsLongitude")
    download_url: str | None = Field(default=None, alias="downloadUrl")
    deep_link: str | None = Field(default=None, alias="googlePhotosDeepLink")


class ScanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    photo_items: list[PhotoItemPayload] | None = Field(default=None, alias="photoItems")
    picker_payload: dict[str, Any] | None = Field(default=None, alias="pickerPayload")
    consent_confirmed: bool = Field(default=False, alias="consentConfirmed")

    @model_validator(mode="after")
    def validate_payload(self) -> "ScanRequest":
        if not self.photo_items and not self.picker_payload:
            raise ValueError("photoItems or pickerPayload is required")
        return self


class PhotoItemSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    create_time: datetime = Field(alias="createTime")
    filename: str | None = None
    mime_type: str | None = Field(default=None, alias="mimeType")
    width: int | None = None
    height: int | None = None
    google_photos_deep_link: str | None = Field(default=None, alias="googlePhotosDeepLink")


class GroupRepresentativePair(BaseModel):
    earliest: PhotoItemSummary
    latest: PhotoItemSummary


class GroupResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    group_id: str = Field(alias="groupId")
    category: str
    items: list[PhotoItemSummary]
    representative_pair: GroupRepresentativePair = Field(alias="representativePair")
    more_count: int = Field(alias="moreCount")
    explanation: str
    google_photos_deep_links: list[str] = Field(alias="googlePhotosDeepLinks")


class StageMetrics(BaseModel):
    timings_ms: dict[str, float] = Field(alias="timingsMs")
    counts: dict[str, int]


class CostEstimate(BaseModel):
    total_cost: float = Field(alias="totalCost")
    download_cost: float = Field(alias="downloadCost")
    hash_cost: float = Field(alias="hashCost")
    comparison_cost: float = Field(alias="comparisonCost")


class ScanResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    run_id: str = Field(alias="runId")
    input_count: int = Field(alias="inputCount")
    stage_metrics: StageMetrics = Field(alias="stageMetrics")
    cost_estimate: CostEstimate = Field(alias="costEstimate")
    groups_exact: list[GroupResult] = Field(alias="groupsExact")
    groups_very_similar: list[GroupResult] = Field(alias="groupsVerySimilar")
    groups_possibly_similar: list[GroupResult] = Field(alias="groupsPossiblySimilar")
