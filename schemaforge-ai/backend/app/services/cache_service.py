import hashlib
import json
from typing import Any

_cache: dict[str, dict[str, Any]] = {}


def _key(prompt: str, dialect: str, normalization: str) -> str:
    raw = f"{prompt}|{dialect}|{normalization}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached(prompt: str, dialect: str, normalization: str) -> dict[str, Any] | None:
    return _cache.get(_key(prompt, dialect, normalization))


def set_cached(prompt: str, dialect: str, normalization: str, data: dict[str, Any]) -> None:
    _cache[_key(prompt, dialect, normalization)] = data
