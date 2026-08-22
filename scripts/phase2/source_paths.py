from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_SOURCE = PROJECT_ROOT / "data-source"
SUPPORTING_FOLDER = DATA_SOURCE / "More Files"

DAY_TO_DAY_MASTER_FILES = {
    "Metals.xlsx",
    "PartsbookBenji2014.xlsx",
}


def day_to_day_master_file(filename: str) -> Path:
    return DATA_SOURCE / filename


def supporting_file(filename: str) -> Path:
    preferred = SUPPORTING_FOLDER / filename
    legacy = DATA_SOURCE / filename
    if preferred.exists() or not legacy.exists():
        return preferred
    return legacy


def source_file(filename: str) -> Path:
    if filename in DAY_TO_DAY_MASTER_FILES:
        return day_to_day_master_file(filename)
    return supporting_file(filename)


def source_file_candidates(filename: str) -> list[Path]:
    if filename in DAY_TO_DAY_MASTER_FILES:
        return [day_to_day_master_file(filename)]
    return [SUPPORTING_FOLDER / filename, DATA_SOURCE / filename]
