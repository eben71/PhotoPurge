from __future__ import annotations

import hashlib
import math
from io import BytesIO
from typing import TYPE_CHECKING, NamedTuple

from app.engine.downloads import DownloadManager
from app.engine.models import PhotoItem


class PerceptualHashes(NamedTuple):
    dhash: int
    phash: int


if TYPE_CHECKING:
    from PIL import Image as PilImage


class HashingService:
    def __init__(self, download_manager: DownloadManager) -> None:
        self._download_manager = download_manager
        self._byte_hash_cache: dict[str, str] = {}
        self._perceptual_cache: dict[str, PerceptualHashes] = {}
        self.byte_hash_count = 0
        self.perceptual_hash_count = 0

    def get_byte_hash(self, item: PhotoItem) -> str:
        if item.id in self._byte_hash_cache:
            return self._byte_hash_cache[item.id]
        digest = hashlib.sha256(self._download_manager.get_bytes(item)).hexdigest()
        self._byte_hash_cache[item.id] = digest
        self.byte_hash_count += 1
        return digest

    def get_perceptual_hashes(self, item: PhotoItem) -> PerceptualHashes:
        if item.id in self._perceptual_cache:
            return self._perceptual_cache[item.id]
        data = self._download_manager.get_bytes(item)
        dhash_value = compute_dhash(data)
        phash_value = compute_phash(data)
        hashes = PerceptualHashes(dhash=dhash_value, phash=phash_value)
        self._perceptual_cache[item.id] = hashes
        self.perceptual_hash_count += 1
        return hashes


def compute_dhash(image_bytes: bytes, *, size: int = 8) -> int:
    image = _load_image(image_bytes).resize((size + 1, size), resample=_resample_lanczos())
    pixels = list(image.getdata())
    result = 0
    for row in range(size):
        for col in range(size):
            left = pixels[row * (size + 1) + col]
            right = pixels[row * (size + 1) + col + 1]
            result = (result << 1) | (1 if left > right else 0)
    return result


def compute_phash(image_bytes: bytes, *, size: int = 32, hash_size: int = 8) -> int:
    image = _load_image(image_bytes).resize((size, size), resample=_resample_lanczos())
    pixels = list(image.getdata())
    matrix = [pixels[i * size : (i + 1) * size] for i in range(size)]
    dct = _dct_2d(matrix)
    dct_low = [row[:hash_size] for row in dct[:hash_size]]
    flat = [coef for row in dct_low for coef in row]
    median = _median(flat[1:])
    result = 0
    for coef in flat:
        result = (result << 1) | (1 if coef > median else 0)
    return result


def hamming_distance(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def _load_image(image_bytes: bytes) -> PilImage.Image:
    from PIL import Image, ImageOps

    with Image.open(BytesIO(image_bytes)) as img:
        transposed = ImageOps.exif_transpose(img)
        grayscale = transposed.convert("L")
        return grayscale.copy()


def _resample_lanczos() -> int:
    from PIL import Image

    return Image.Resampling.LANCZOS


def _dct_2d(matrix: list[list[int]]) -> list[list[float]]:
    size = len(matrix)
    cos_table = [
        [math.cos(((2 * x + 1) * u * math.pi) / (2 * size)) for x in range(size)]
        for u in range(size)
    ]
    dct: list[list[float]] = [[0.0 for _ in range(size)] for _ in range(size)]
    scale = math.sqrt(2 / size)
    for u in range(size):
        for v in range(size):
            total = 0.0
            for x in range(size):
                for y in range(size):
                    total += matrix[x][y] * cos_table[u][x] * cos_table[v][y]
            cu = 1 / math.sqrt(2) if u == 0 else 1.0
            cv = 1 / math.sqrt(2) if v == 0 else 1.0
            dct[u][v] = scale * cu * cv * total
    return dct


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    mid = len(sorted_values) // 2
    if len(sorted_values) % 2 == 0:
        return (sorted_values[mid - 1] + sorted_values[mid]) / 2
    return sorted_values[mid]
