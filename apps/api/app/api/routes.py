import logging

from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.engine.normalizer import normalize_photo_items, normalize_picker_payload
from app.engine.scan import run_scan
from app.engine.schemas import ScanRequest, ScanResult

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "phase": "feasibility"}


@router.post("/api/scan", response_model=ScanResult)
def scan(request: ScanRequest) -> ScanResult:
    settings = get_settings()
    if request.photo_items:
        items = normalize_photo_items(request.photo_items)
    else:
        items = normalize_picker_payload(request.picker_payload or {})

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid photo items provided.",
        )

    input_count = len(items)
    if input_count > settings.scan_max_photos:
        message = (
            f"Scan requested {input_count} items; max allowed is {settings.scan_max_photos}."
        )
        if settings.enforce_scan_limits:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        logger.warning(message)

    if input_count > settings.scan_consent_threshold and not request.consent_confirmed:
        message = (
            "Scan exceeds consent threshold; explicit consent is required in production."
        )
        if settings.enforce_scan_limits:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        logger.warning(message)

    return run_scan(items, settings)
