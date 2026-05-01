#!/usr/bin/env python3
"""
Phase 2 sync — refresh all customer-facing Excel files from the master files.

Workflow:
  1. Owner edits prices in data-source/Metals.xlsx and/or PartsbookBenji2014.xlsx
  2. Run `npm run sync-excel` (this script)
  3. Fresh files appear in final-deliverables/:
       • Metals catalogue 2023.xlsx           — VLOOKUPs into a hidden _PriceLookup
       • Metals Invoice.xlsm                  — visible filterable _PriceLookup tab
       • Mini Catalogue Self Updating.xlsm    — VLOOKUPs into a hidden _PriceLookup
       • Mini Invoice Template.xlsm           — visible filterable _PriceLookup tab
                                                  (only if the unprotected file is present)
  4. Hand those files to the owner

Each step internally reads its master file in memory — no intermediate
files are written, and the `data-source/` originals are never modified.
"""
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent

# Files required for the metals side of Phase 2
REQUIRED_METALS = [
    PROJECT_ROOT / "data-source" / "Metals.xlsx",
    PROJECT_ROOT / "data-source" / "Metals catalogue 2023.xlsx",
    PROJECT_ROOT / "data-source" / "Metals Invoice.xlsm",
]

# Files required for the mini side of Phase 2b
REQUIRED_MINI = [
    PROJECT_ROOT / "data-source" / "PartsbookBenji2014.xlsx",
    PROJECT_ROOT / "data-source" / "Mini Catalogue Self Updating.xlsm",
]

# Optional — only wired if present (waiting on Guy to remove the password)
OPTIONAL_MINI_INVOICE = PROJECT_ROOT / "data-source" / "Mini Invoice Template.xlsm"


def check_inputs():
    missing_metals = [str(p) for p in REQUIRED_METALS if not p.exists()]
    missing_mini   = [str(p) for p in REQUIRED_MINI   if not p.exists()]
    if missing_metals or missing_mini:
        print("ERROR: Phase 2 sync needs these files in data-source/:")
        for m in (missing_metals + missing_mini):
            print(f"  - {m}")
        print()
        print("Drop the latest copies from the owner into data-source/ and re-run.")
        sys.exit(1)


def run_step(name, script):
    print()
    print(f"━━━ {name} ━━━")
    result = subprocess.run([sys.executable, str(HERE / script)], cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print(f"ERROR: {script} failed. Stopping.")
        sys.exit(result.returncode)


def main():
    print("Phase 2 sync — refreshing all customer-facing Excel files")
    check_inputs()
    (PROJECT_ROOT / "final-deliverables").mkdir(exist_ok=True)

    steps = [
        ("Wire the Metals catalogue 2023",       "wire_catalogue.py"),
        ("Wire the Metals Invoice (.xlsm)",      "wire_invoice.py"),
        ("Wire the Mini Catalogue Self Updating", "wire_mini_catalogue.py"),
    ]
    if OPTIONAL_MINI_INVOICE.exists():
        steps.append(("Wire the Mini Invoice Template (.xlsm)", "wire_mini_invoice.py"))
    else:
        print()
        print("  (skipping Mini Invoice Template — file not yet in data-source/)")

    for i, (name, script) in enumerate(steps, 1):
        run_step(f"Step {i} of {len(steps)} — {name}", script)

    print()
    print("✓ Done.")
    print(f"  Fresh files are in:  final-deliverables/")


if __name__ == "__main__":
    main()
