from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.engine import hashing


def test_load_image_returns_grayscale_copy():
    image_bytes = _make_image_bytes("RGB", (10, 10), (10, 20, 30))

    loaded = hashing._load_image(image_bytes)

    assert loaded.mode == "L"
    assert loaded.size == (10, 10)


def test_compute_dhash_returns_zero_for_uniform_image():
    image_bytes = _make_image_bytes("L", (9, 8), 128)

    assert hashing.compute_dhash(image_bytes, size=8) == 0


def test_compute_phash_sets_single_high_bit_for_uniform_image():
    image_bytes = _make_image_bytes("L", (32, 32), 200)

    result = hashing.compute_phash(image_bytes, size=32, hash_size=8)

    assert result == 1 << ((8 * 8) - 1)


def test_hamming_distance_counts_bits():
    assert hashing.hamming_distance(0b1010, 0b0011) == 3


def _make_image_bytes(mode: str, size: tuple[int, int], color: int | tuple[int, int, int]) -> bytes:
    image = Image.new(mode, size, color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
