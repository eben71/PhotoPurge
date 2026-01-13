from __future__ import annotations

from app.engine import hashing


def test_median_handles_odd_and_even_lengths():
    assert hashing._median([1.0, 3.0, 2.0]) == 2.0
    assert hashing._median([1.0, 2.0, 3.0, 4.0]) == 2.5


def test_compute_dhash_returns_zero_for_uniform_image(monkeypatch):
    image_bytes = b"uniform"

    monkeypatch.setattr(hashing, "_load_image", lambda _: _FakeImage(128))
    monkeypatch.setattr(hashing, "_resample_lanczos", lambda: 0)
    assert hashing.compute_dhash(image_bytes, size=8) == 0


def test_compute_phash_sets_single_high_bit_for_uniform_image(monkeypatch):
    image_bytes = b"uniform"

    monkeypatch.setattr(hashing, "_load_image", lambda _: _FakeImage(200))
    monkeypatch.setattr(hashing, "_resample_lanczos", lambda: 0)
    result = hashing.compute_phash(image_bytes, size=32, hash_size=8)

    assert result & (1 << ((8 * 8) - 1))


def test_hamming_distance_counts_bits():
    assert hashing.hamming_distance(0b1010, 0b0011) == 2


class _FakeImage:
    def __init__(self, fill: int) -> None:
        self._fill = fill
        self._size: tuple[int, int] = (0, 0)

    def resize(self, size: tuple[int, int], resample: int | None = None) -> _FakeImage:
        self._size = size
        return self

    def getdata(self) -> list[int]:
        width, height = self._size
        return [self._fill] * (width * height)
