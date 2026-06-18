#!/usr/bin/env python3
"""Deterministic matching between the metals catalogue and Metals.xlsx.

The owner's files contain decades of abbreviations and layout conventions.
This module normalises those conventions, establishes a stable private link
for each catalogue row, and reuses that link on every later sync. Prices are
never part of an established identity, so changing a price cannot break a
match.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
LINKS_PATH = PROJECT_ROOT / "data-source" / ".metal-links.json"


def text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalise(value) -> str:
    value = text(value).lower()
    value = (
        value.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u00a0", " ")
        .replace("\u00d7", "x")
    )
    return re.sub(r"\s+", " ", value).strip()


def compact(value) -> str:
    return re.sub(r"[^a-z0-9.]+", "", normalise(value))


def normalise_size(value) -> str:
    value = normalise(value)
    value = re.sub(r"(\d+)\s+(\d+/\d+)", r"\1+\2", value)
    value = value.replace(" diameter", "d").replace(" dia", "d")
    value = value.replace('"', "")
    value = re.sub(
        r"\b(?:natural|black|riveting|stainless|in\s+coil|coiled|dpb|af|hex|wall|soft|o/p)\b",
        "",
        value,
    )
    value = re.sub(r"\b(?:thick|th)\b", "", value)
    value = value.replace("(", "").replace(")", "")
    value = re.sub(r"(?<!\d)0+\.(\d+)", r".\1", value)
    value = re.sub(r"(\d+)\.0(?=\D|$)", r"\1", value)
    return re.sub(r"[\s,]+", "", value)


def normalise_unit(value) -> str:
    value = compact(value)
    aliases = {
        "ft": "foot",
        "foot300mm": "foot",
        "foot": "foot",
        "perfoot": "foot",
        "each": "each",
        "ea": "each",
        "kg": "kg",
        "perkilo": "kg",
        "perkg": "kg",
        "metre": "metre",
        "meter": "metre",
        "mtr": "metre",
        "sheet": "sheet",
        "length": "length",
    }
    return aliases.get(value, value)


SHAPE_ALIASES = {
    "round": "diameter",
    "rounds": "diameter",
    "diameter": "diameter",
    "diameters": "diameter",
    "diams": "diameter",
    "grndrnds": "diameter",
    "groundrounds": "diameter",
    "flat": "flat",
    "flats": "flat",
    "square": "square",
    "squares": "square",
    "tube": "tube",
    "tubes": "tube",
    "box": "box",
    "rectangebox": "rectanglebox",
    "rectanglebox": "rectanglebox",
    "rectangularbox": "rectanglebox",
    "rectangeboxsteel": "rectanglebox",
    "hollow": "hollow",
    "eqangle": "equalangle",
    "equalangle": "equalangle",
    "unequalang": "unequalangle",
    "unequalangle": "unequalangle",
    "unequal": "unequalangle",
    "angle": "angle",
    "channel": "channel",
    "tee": "tee",
    "tees": "tee",
    "sheet": "sheet",
    "shim": "shim",
    "wire": "wire",
    "wirestraight": "wire",
    "wirecoiled": "coiledwire",
    "coiled": "coiledwire",
    "boilerband": "boilerband",
    "halfrnd": "halfround",
    "halfround": "halfround",
    "hexagon": "hexagon",
    "hexagons": "hexagon",
    "rect": "rectangle",
    "rectangle": "rectangle",
    "hardstrip": "hardstrip",
    "foil": "foil",
    "keysteel": "keysteel",
    "studding": "studding",
    "tinplate": "tinplate",
    "nuts": "nuts",
    "washers": "washers",
}


def canonical_shape(value) -> str:
    return SHAPE_ALIASES.get(compact(value), "")


def effective_shape(shape, size="") -> str:
    explicit = canonical_shape(shape)
    if explicit:
        return explicit
    size_value = normalise(size)
    if " od" in size_value and any(token in size_value for token in (" id", " wall", "swg")):
        return "tube"
    if re.search(r"\baf\b", size_value):
        return "hexagon"
    if re.search(r"\bsq\b", size_value):
        return "square"
    if re.search(r"\bd\b", size_value):
        return "diameter"
    return ""


def is_shape_heading(value) -> bool:
    return bool(canonical_shape(value))


def material_family(value, grade="", spec="") -> str:
    combined = compact(" ".join([text(value), text(grade), text(spec)]))

    if any(token in combined for token in ("stainless", "ststeel", "stst")):
        return "stainless_steel"
    if "silversteel" in combined:
        return "silver_steel"
    if "gaugeplate" in combined:
        return "gauge_plate"
    if any(token in combined for token in ("nickelsilver", "nilag")):
        return "nickel_silver"
    if any(token in combined for token in ("albronze", "aluminiumbronze", "mangbr", "manganesebronze", "ca104")):
        return "aluminium_bronze"
    if any(token in combined for token in ("leadgm", "leadedgunmetal", "gunmetal", "sae660", "lg2", "lg4", "sandybr")):
        return "leaded_gunmetal"
    if any(token in combined for token in ("phosbronze", "phosphorbronze", "colphos", "pb102", "pb1")):
        return "phosphor_bronze"
    if "castiron" in combined:
        return "cast_iron"
    if any(token in combined for token in (
        "acetal", "nylon", "tufnol", "ptfe", "delrin", "perspex",
        "acrylic", "hdpe", "pvc", "pcarb", "polycarbonate",
        "polypropylene", "fluorosint", "tecacryl", "tecafine",
        "aquanyl", "nylatron", "abs", "plastic",
    )):
        return "plastics"
    if "copper" in combined or combined.startswith("cu"):
        return "copper"
    if any(token in combined for token in (
        "navalbr", "brass", "gildingmetal", "cz112", "cz120", "cz121", "cz126",
    )):
        return "brass"
    if any(token in combined for token in (
        "aluminium", "aluminum", "he30", "he9", "6082", "6063", "6026", "6262",
    )):
        return "aluminium"
    if any(token in combined for token in (
        "steel", "blackms", "brightms", "spring", "rebar", "mildsteel", "m08", "mo8",
    )):
        return "steel"
    return compact(value) or compact(grade) or compact(spec)


GRADE_EQUIVALENTS = {
    "he30": {"he30", "6082", "6082t6"},
    "6082": {"he30", "6082", "6082t6"},
    "6082t6": {"he30", "6082", "6082t6"},
    "he9": {"he9", "6063", "6063t6"},
    "6063": {"he9", "6063", "6063t6"},
    "6063t6": {"he9", "6063", "6063t6"},
    "pb1": {"pb1", "cusn12", "cusn12c"},
    "cusn12": {"pb1", "cusn12", "cusn12c"},
    "cusn12c": {"pb1", "cusn12", "cusn12c"},
    "2011": {"2011", "2011t3"},
    "2011t3": {"2011", "2011t3"},
}


def spec_aliases(*values) -> set[str]:
    aliases: set[str] = set()
    for value in values:
        raw = normalise(value)
        if not raw:
            continue
        full = compact(raw)
        if full:
            aliases.add(full)
            alloy = re.match(r"^(\d{4})(?:[a-z].*)$", full)
            if alloy:
                aliases.add(alloy.group(1))

        for token in re.findall(r"[a-z]{0,5}\d+(?:\.\d+)*(?:[a-z]\d*)?", raw):
            token = compact(token)
            if len(token) >= 2:
                aliases.add(token)

        for code in re.findall(r"\b(?:cz|ca|pb|lg|he|en|sae)\s*[-/]?\s*\d+[a-z0-9]*\b", raw):
            aliases.add(compact(code))

    expanded = set(aliases)
    for alias in aliases:
        expanded.update(GRADE_EQUIVALENTS.get(alias, set()))
    return expanded


def make_catalogue_base(sheet, shape, metal, spec, size, unit) -> str:
    return "|".join([
        normalise(sheet),
        canonical_shape(shape) or compact(shape),
        compact(metal),
        compact(spec),
        normalise_size(size),
        normalise_unit(unit),
    ])


def make_catalogue_link_id(sheet, shape, metal, spec, size, unit, occurrence=1) -> str:
    return f"{make_catalogue_base(sheet, shape, metal, spec, size, unit)}|{occurrence}"


def make_master_base(row: dict) -> str:
    return "|".join([
        normalise(row.get("sourceSheet")),
        canonical_shape(row.get("shape")) or compact(row.get("shape")),
        compact(row.get("metal")),
        compact(row.get("grade")),
        compact(row.get("spec")),
        normalise_size(row.get("size")),
        normalise_unit(row.get("unit")),
    ])


def assign_master_link_ids(rows: list[dict]) -> None:
    occurrences: dict[str, int] = defaultdict(int)
    for row in rows:
        base = make_master_base(row)
        occurrences[base] += 1
        row["linkId"] = f"{base}|{occurrences[base]}"


def load_links(path: Path = LINKS_PATH) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    links = payload.get("links") if isinstance(payload, dict) else None
    return links if isinstance(links, dict) else {}


def save_links(links: dict[str, str], path: Path = LINKS_PATH) -> None:
    payload = {
        "version": 1,
        "_comment": (
            "Auto-managed by the M-Machine sync. Stable catalogue-to-master "
            "links; prices are deliberately not part of either identity."
        ),
        "links": dict(sorted(links.items())),
    }
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


@dataclass
class MatchResult:
    lookup_key: str | None
    confidence: str
    master: dict | None
    link_id: str
    broken_persisted_link: bool = False


class MetalMatcher:
    def __init__(self, lookup_rows: list[tuple], links_path: Path = LINKS_PATH):
        self.links_path = links_path
        self.links = load_links(links_path)
        self.changed = False
        self.broken_links: list[str] = []
        self.seen_catalogue_links: set[str] = set()
        self.records: list[dict] = []
        self.by_link_id: dict[str, dict] = {}
        self.by_size: dict[str, list[dict]] = defaultdict(list)

        for row in lookup_rows:
            record = {
                "lookupKey": row[0],
                "shape": row[1],
                "metal": row[2],
                "spec": row[3],
                "size": row[4],
                "priceEx": row[5],
                "unit": row[6],
                "sourceSheet": row[7],
                "sourceRow": row[8],
                "code": row[9] if len(row) > 9 else "",
                "grade": row[10] if len(row) > 10 else "",
                "linkId": row[11] if len(row) > 11 else "",
            }
            record["family"] = material_family(
                record["metal"], record["grade"], record["spec"]
            )
            record["shapeKey"] = effective_shape(record["shape"], record["size"])
            record["sizeKey"] = normalise_size(record["size"])
            record["unitKey"] = normalise_unit(record["unit"])
            record["specAliases"] = spec_aliases(
                record["grade"], record["spec"]
            )
            record["metalKey"] = compact(record["metal"])
            self.records.append(record)
            if record["linkId"]:
                self.by_link_id[record["linkId"]] = record
            self.by_size[record["sizeKey"]].append(record)

    def _score(self, catalogue: dict, master: dict, existing_price) -> tuple[int, bool]:
        score = 0
        catalogue_aliases = spec_aliases(catalogue.get("spec"))
        overlap = catalogue_aliases & master["specAliases"]
        strong_spec = bool(overlap)

        if strong_spec:
            score += 55
        elif not catalogue_aliases and not master["specAliases"]:
            score += 8
        elif catalogue_aliases and master["specAliases"]:
            score -= 22

        cat_shape = effective_shape(catalogue.get("shape"), catalogue.get("size"))
        if cat_shape and master["shapeKey"] == cat_shape:
            score += 28
        elif not cat_shape or not master["shapeKey"]:
            score += 3

        cat_metal = compact(catalogue.get("metal"))
        if cat_metal and cat_metal == master["metalKey"]:
            score += 24
        elif cat_metal and (
            cat_metal in master["metalKey"] or master["metalKey"] in cat_metal
        ):
            score += 12

        if compact(catalogue.get("shape")) == master["metalKey"]:
            score += 35

        cat_unit = normalise_unit(catalogue.get("unit"))
        if cat_unit and master["unitKey"] == cat_unit:
            score += 12

        if (
            isinstance(existing_price, (int, float))
            and isinstance(master["priceEx"], (int, float))
            and abs(float(existing_price) - float(master["priceEx"])) < 0.0001
        ):
            score += 18

        cat_spec = compact(catalogue.get("spec"))
        if cat_spec:
            if cat_spec == compact(master.get("grade")):
                score += 24
            if cat_spec == compact(master.get("spec")):
                score += 20

        return score, strong_spec

    def match(self, catalogue: dict, catalogue_link_id: str, existing_price=None) -> MatchResult:
        self.seen_catalogue_links.add(catalogue_link_id)
        persisted_target = self.links.get(catalogue_link_id)
        if persisted_target:
            master = self.by_link_id.get(persisted_target)
            if master:
                return MatchResult(
                    master["lookupKey"], "persisted", master, catalogue_link_id
                )
            self.broken_links.append(catalogue_link_id)
            self.links.pop(catalogue_link_id, None)
            self.changed = True

        size_key = normalise_size(catalogue.get("size"))
        family = material_family(
            catalogue.get("metal"), "", catalogue.get("spec")
        )
        candidates = [
            row
            for row in self.by_size.get(size_key, [])
            if row["family"] == family
        ]

        if not candidates:
            return MatchResult(
                None,
                "unmatched",
                None,
                catalogue_link_id,
                broken_persisted_link=bool(persisted_target),
            )

        ranked = []
        for candidate in candidates:
            score, strong_spec = self._score(
                catalogue, candidate, existing_price
            )
            ranked.append((score, strong_spec, candidate))
        ranked.sort(
            key=lambda item: (
                item[0],
                item[1],
                -int(item[2]["sourceRow"]),
                item[2]["linkId"],
            ),
            reverse=True,
        )

        best_score, best_strong_spec, best = ranked[0]
        second_score = ranked[1][0] if len(ranked) > 1 else -1
        catalogue_aliases = spec_aliases(catalogue.get("spec"))
        best_spec_conflict = bool(
            catalogue_aliases
            and best["specAliases"]
            and not (catalogue_aliases & best["specAliases"])
        )

        confidence = None
        if len(ranked) == 1 and not best_spec_conflict:
            confidence = "unique"
        elif best_score >= 55 and best_score - second_score >= 8:
            confidence = "strong"
        elif best_strong_spec and best_score - second_score >= 4:
            confidence = "spec"
        else:
            same_price = [
                item
                for item in ranked
                if isinstance(existing_price, (int, float))
                and isinstance(item[2]["priceEx"], (int, float))
                and abs(float(existing_price) - float(item[2]["priceEx"])) < 0.0001
            ]
            same_price.sort(key=lambda item: item[0], reverse=True)
            if len(same_price) == 1 or (
                len(same_price) > 1
                and same_price[0][0] > same_price[1][0]
            ):
                best = same_price[0][2]
                confidence = "price-bootstrap"

        if not confidence and len(ranked) > 1:
            top_score = ranked[0][0]
            top = [item[2] for item in ranked if item[0] == top_score]
            signatures = {
                (
                    item["metalKey"],
                    item["shapeKey"],
                    tuple(sorted(item["specAliases"])),
                    item["priceEx"],
                )
                for item in top
            }
            if len(signatures) == 1:
                best = top[0]
                confidence = "equivalent-duplicate"

        # Some legacy rows are genuine duplicate candidates with incomplete
        # source labels. A high score means material, dimensions, shape and
        # grade/spec evidence agree; choose deterministically and persist it.
        if not confidence and best_score >= 100 and not best_spec_conflict:
            confidence = "deterministic"

        if not confidence:
            return MatchResult(
                None,
                "ambiguous",
                None,
                catalogue_link_id,
                broken_persisted_link=bool(persisted_target),
            )

        self.links[catalogue_link_id] = best["linkId"]
        self.changed = True
        return MatchResult(
            best["lookupKey"],
            confidence,
            best,
            catalogue_link_id,
            broken_persisted_link=bool(persisted_target),
        )

    def save(self) -> None:
        stale = set(self.links) - self.seen_catalogue_links
        if stale:
            for key in stale:
                self.links.pop(key, None)
            self.changed = True
        if self.changed:
            save_links(self.links, self.links_path)
