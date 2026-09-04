from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_SOURCE = PROJECT_ROOT / "data-source"
SUPPORTING_FOLDER = DATA_SOURCE / "More Files"

DAY_TO_DAY_MASTER_FILES = {
    "Metals.xlsx",
    "PartsbookBenji2014.xlsx",
}

METALS_CATALOGUE_FILENAMES = [
    "Metals Catalogue.xlsx",
    "Metals catalogue.xlsx",
    "Metals catalogue 2023.xlsx",
]

SOURCE_FILE_ALIASES = {
    "Metals Catalogue.xlsx": METALS_CATALOGUE_FILENAMES,
    "Metals catalogue.xlsx": METALS_CATALOGUE_FILENAMES,
    "Metals catalogue 2023.xlsx": METALS_CATALOGUE_FILENAMES,
}


def day_to_day_master_file(filename: str) -> Path:
    return DATA_SOURCE / filename


def supporting_file(filename: str) -> Path:
    for candidate in SOURCE_FILE_ALIASES.get(filename, [filename]):
        preferred = SUPPORTING_FOLDER / candidate
        if preferred.exists():
            return preferred

    for candidate in SOURCE_FILE_ALIASES.get(filename, [filename]):
        legacy = DATA_SOURCE / candidate
        if legacy.exists():
            return legacy

    return SUPPORTING_FOLDER / SOURCE_FILE_ALIASES.get(filename, [filename])[0]


def source_file(filename: str) -> Path:
    if filename in DAY_TO_DAY_MASTER_FILES:
        return day_to_day_master_file(filename)
    return supporting_file(filename)


def source_file_candidates(filename: str) -> list[Path]:
    if filename in DAY_TO_DAY_MASTER_FILES:
        return [day_to_day_master_file(filename)]
    candidates = SOURCE_FILE_ALIASES.get(filename, [filename])
    return [SUPPORTING_FOLDER / candidate for candidate in candidates] + [
        DATA_SOURCE / candidate for candidate in candidates
    ]
