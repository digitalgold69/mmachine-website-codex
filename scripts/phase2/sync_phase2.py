#!/usr/bin/env python3
"""
Refresh the customer-facing catalogue files from the master files.

The owner wants both invoice templates left exactly as she already uses them.
So this script now does only two kinds of work:

  1. Rebuild the two catalogue files with fresh prices from the master files.
  2. Copy the two invoice templates through unchanged, if they are present.

Nothing in data-source/ is modified. The refreshed files land in
final-deliverables/ for the owner's "Customer Files" desktop folder.
"""
import shutil
import subprocess
import sys
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent

# Files required to rebuild the two catalogue files.
REQUIRED_FILES = [
    PROJECT_ROOT / "data-source" / "Metals.xlsx",
    PROJECT_ROOT / "data-source" / "Metals catalogue 2023.xlsx",
    PROJECT_ROOT / "data-source" / "PartsbookBenji2014.xlsx",
    PROJECT_ROOT / "data-source" / "Mini Catalogue Self Updating.xlsm",
]

# These are copied as-is. They are deliberately not rewired or edited.
OPTIONAL_INVOICE_TEMPLATES = [
    PROJECT_ROOT / "data-source" / "Metals Invoice.xlsm",
    PROJECT_ROOT / "data-source" / "Mini Invoice Template.xlsm",
]


def check_inputs():
    missing = [str(p) for p in REQUIRED_FILES if not p.exists()]
    if missing:
        print("ERROR: catalogue sync needs these files in data-source/:")
        for m in missing:
            print(f"  - {m}")
        print()
        print("Drop the latest copies from the owner into data-source/ and re-run.")
        sys.exit(1)


def run_step(name, script):
    print()
    print(f"--- {name} ---", flush=True)
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8:replace")
    env.setdefault("PYTHONUNBUFFERED", "1")
    result = subprocess.run([sys.executable, str(HERE / script)], cwd=PROJECT_ROOT, env=env)
    if result.returncode != 0:
        print(f"ERROR: {script} failed. Stopping.")
        sys.exit(result.returncode)


def copy_invoice_templates():
    """Copy invoice templates unchanged into final-deliverables.

    If an invoice is open in Excel, Windows may lock the destination. In that
    case, warn and keep going because catalogue and website refreshes should
    not be blocked by a working invoice.
    """
    print()
    print("--- Copy original invoice templates unchanged ---")
    for src in OPTIONAL_INVOICE_TEMPLATES:
        if not src.exists():
            print(f"  (skipping {src.name} - not present in data-source)")
            continue

        dst = PROJECT_ROOT / "final-deliverables" / src.name
        try:
            shutil.copy2(src, dst)
            print(f"  copied {src.name}")
        except PermissionError:
            print(f"  WARNING: could not replace {dst.name}; close it in Excel and re-run.")


def main():
    print("Refreshing customer catalogue files from Excel")
    check_inputs()
    (PROJECT_ROOT / "final-deliverables").mkdir(exist_ok=True)

    steps = [
        ("Step 1 of 2 - Wire the Metals catalogue 2023", "wire_catalogue.py"),
        ("Step 2 of 2 - Wire the Mini Catalogue Self Updating", "wire_mini_catalogue.py"),
    ]

    for name, script in steps:
        run_step(name, script)

    copy_invoice_templates()

    print()
    print("Done.")
    print("  Fresh customer files are in: final-deliverables/")


if __name__ == "__main__":
    main()
