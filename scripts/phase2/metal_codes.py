#!/usr/bin/env python3
"""
Metal-code assignment + persistence.

Goal: every metal in the master gets a stable, mostly-meaningful code that:
  • Looks like the existing Grade column on the website (e.g. HE30-5/8"x5/8"x1/16")
  • Disambiguates same-spec/same-size collisions with a short shape suffix
  • Stays the same across syncs, even if the master row order shifts

The mapping is persisted in data-source/.metal-codes.json. That file is
tracked in git so codes survive machine moves and re-clones.
"""
import json
import re
from pathlib import Path
from typing import Iterable

# Composite-key parts: metal | spec | size | shape (lowercase, trimmed,
# normalized whitespace + quotes). Same as build_lookup.normalise().
def normalise_part(v: object) -> str:
    if v is None: return ""
    s = str(v).strip().lower()
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace(" ", " ")
    s = re.sub(r"\s+", " ", s)
    return s


def composite_key(metal, spec, size, shape) -> str:
    return "|".join([
        normalise_part(metal),
        normalise_part(spec),
        normalise_part(size),
        normalise_part(shape),
    ])


# Short shape suffix for disambiguating collisions. First two non-space
# letters of the shape, uppercased. "Equal Angle" → EA, "Tee" → TE, etc.
def shape_suffix(shape: str) -> str:
    if not shape: return "X"
    # Strip non-alpha chars; take first 2 letters
    letters = re.sub(r"[^A-Za-z]", "", str(shape))
    if not letters: return "X"
    return letters[:2].upper()


def candidate_code(metal: str, spec: str, size: str) -> str:
    """The base code before any disambiguation. Matches the website's
    Grade column convention: <SPEC>-<SIZE> (or <METAL>-<SIZE> if no spec).
    Whitespace in size is stripped to compact the code."""
    spec_part = (spec or metal or "").strip()
    size_part = (size or "").strip()
    # Compact: drop internal whitespace from size, e.g. '1" x 1" x 1/8"' → '1"x1"x1/8"'
    size_part = re.sub(r"\s+", "", size_part)
    if size_part:
        return f"{spec_part}-{size_part}"
    return spec_part


def assign_codes(
    rows: Iterable,
    existing: dict | None = None,
) -> dict:
    """Assign a code to every row.

    rows: iterable of dicts each with keys {metal, spec, size, shape}.
    existing: previous {composite_key → code} mapping (preserves stability).

    Returns: {composite_key → code} for ALL rows passed in. Existing codes
    are preserved; new rows get fresh codes with collision suffixes.
    """
    existing = existing or {}
    out: dict = {}
    # Track candidate codes already taken to detect collisions
    taken: set[str] = set(existing.values())

    # First pass: compute composite keys + candidate codes
    pending: list = []
    for r in rows:
        metal = r.get("metal", "")
        spec  = r.get("spec",  "")
        size  = r.get("size",  "")
        shape = r.get("shape", "")
        ckey = composite_key(metal, spec, size, shape)

        if ckey in existing:
            out[ckey] = existing[ckey]
            continue

        cand = candidate_code(metal, spec, size)
        pending.append((ckey, cand, shape))

    # Second pass: group pending by candidate, disambiguate collisions
    by_cand: dict = {}
    for ckey, cand, shape in pending:
        by_cand.setdefault(cand, []).append((ckey, shape))

    for cand, group in by_cand.items():
        if len(group) == 1 and cand not in taken:
            ckey, _shape = group[0]
            out[ckey] = cand
            taken.add(cand)
        else:
            # Collision (or already taken by an existing code) — append a
            # shape suffix to each. If still colliding, append a numeric.
            seen_suffix: dict = {}
            for ckey, shape in group:
                suf = shape_suffix(shape)
                final = f"{cand}-{suf}"
                # If two rows have the same shape too (rare), bump a digit
                n = seen_suffix.get(final, 0)
                if n > 0 or final in taken:
                    final = f"{final}{n + 1}"
                    seen_suffix[final] = 1
                else:
                    seen_suffix[final] = 1
                out[ckey] = final
                taken.add(final)

    return out


def load_codes_file(path: Path) -> dict:
    """Read the persistent .metal-codes.json. Returns {} if absent."""
    if not path.exists(): return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict): return {}
    codes = data.get("codes")
    return codes if isinstance(codes, dict) else {}


def save_codes_file(path: Path, codes: dict) -> None:
    """Write {ckey → code} back to .metal-codes.json. Stable order."""
    payload = {
        "version": 1,
        "_comment": "Auto-managed by sync. Don't edit by hand. "
                    "Each metal's stable code, keyed by metal|spec|size|shape.",
        "codes": dict(sorted(codes.items())),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
