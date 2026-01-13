from collections.abc import Callable, Sequence
from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, EnvSettingsSource, SettingsConfigDict

SettingsSourceCallable = Callable[[], dict[str, Any]]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    app_name: str = "PhotoPrune API"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/photoprune"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    environment: str = "local"
    scan_max_photos: int = 250
    scan_consent_threshold: int = 200
    scan_allowed_download_hosts: list[str] = [
        "photos.google.com",
        "lh3.googleusercontent.com",
        "googleusercontent.com",
    ]
    scan_dhash_threshold_very: int = 5
    scan_dhash_threshold_possible: int = 10
    scan_phash_threshold_very: int = 6
    scan_phash_threshold_possible: int = 12
    scan_cost_per_download: float = 0.0002
    scan_cost_per_byte_hash: float = 0.00005
    scan_cost_per_perceptual_hash: float = 0.00008
    scan_cost_per_comparison: float = 0.00001

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: Sequence[str] | str) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return list(value)

    @field_validator("scan_allowed_download_hosts", mode="before")
    @classmethod
    def split_allowed_hosts(cls, value: Sequence[str] | str) -> list[str]:
        if isinstance(value, str):
            return [host.strip() for host in value.split(",") if host.strip()]
        return list(value)

    @property
    def enforce_scan_limits(self) -> bool:
        return self.environment.lower() == "prod"

    @classmethod
    def settings_customise_sources(  # type: ignore[override]
        cls: type["Settings"],
        settings_cls: type["Settings"],
        init_settings: SettingsSourceCallable,
        env_settings: SettingsSourceCallable,
        dotenv_settings: SettingsSourceCallable,
        file_secret_settings: SettingsSourceCallable,
    ) -> tuple[SettingsSourceCallable, ...]:
        class CorsEnvSettingsSource(EnvSettingsSource):
            def decode_complex_value(self, field_name: str, field: Any, value: Any) -> Any:
                if field_name == "cors_origins" and isinstance(value, str):
                    return value
                return super().decode_complex_value(field_name, field, value)

        return (
            init_settings,
            CorsEnvSettingsSource(settings_cls),
            dotenv_settings,
            file_secret_settings,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
