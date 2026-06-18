#!/usr/bin/env python3
"""Stable public codes for customer-facing metals catalogue rows."""

from __future__ import annotations

import json
from pathlib import Path

from metal_codes import candidate_code, shape_suffix


HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
CODES_PATH = PROJECT_ROOT / "data-source" / ".metal-catalogue-codes.json"


def load_codes(path: Path = CODES_PATH) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    codes = payload.get("codes") if isinstance(payload, dict) else None
    return codes if isinstance(codes, dict) else {}


def save_codes(codes: dict[str, str], path: Path = CODES_PATH) -> None:
    payload = {
        "version": 1,
        "_comment": (
            "Auto-managed by the M-Machine sync. Stable public metals codes "
            "keyed by customer catalogue product identity."
        ),
        "codes": dict(sorted(codes.items())),
    }
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


class CatalogueCodeRegistry:
    def __init__(self, path: Path = CODES_PATH):
        self.path = path
        self.codes = load_codes(path)
        self.seen: set[str] = set()
        self.taken = set(self.codes.values())
        self.changed = False

    def get(self, link_id: str, metal: str, spec: str, size: str, shape: str) -> str:
        self.seen.add(link_id)
        existing = self.codes.get(link_id)
        if existing:
            return existing

        base = candidate_code(metal, spec, size)
        code = base
        if code in self.taken:
            suffix = shape_suffix(shape)
            code = f"{base}-{suffix}"
            counter = 2
            while code in self.taken:
                code = f"{base}-{suffix}{counter}"
                counter += 1

        self.codes[link_id] = code
        self.taken.add(code)
        self.changed = True
        return code

    def save(self) -> None:
        stale = set(self.codes) - self.seen
        if stale:
            for key in stale:
                self.codes.pop(key, None)
            self.changed = True
        if self.changed:
            save_codes(self.codes, self.path)
