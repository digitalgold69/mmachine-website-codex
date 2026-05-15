#!/usr/bin/env python3
"""
Refresh the customer-facing catalogue files from the master files.

The owner wants both invoice templates left exactly as she already uses them.
So this script now does only two kinds of work:

  1. Rebuild the two catalogue files with fresh prices from the master files.
  2. Copy the two invoice templates through, if they are present.

The Metals invoice is copied byte-for-byte. The Mini invoice keeps the owner's
original layout, macros, and formulas, but its external workbook link is pointed
at the current PartsbookBenji2014.xlsx master so its code-entry price fill keeps
working from the Customer Files folder.

Nothing in data-source/ is modified. The refreshed files land in
final-deliverables/ for the owner's "Customer Files" desktop folder.
"""
import shutil
import subprocess
import sys
import os
import re
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

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

MINI_INVOICE_NAME = "Mini Invoice Template.xlsm"
MINI_MASTER = PROJECT_ROOT / "data-source" / "PartsbookBenji2014.xlsx"


def _excel_external_target(path):
    """Return an Excel-friendly external-link target."""
    return path.resolve().as_posix()


def point_mini_invoice_at_master(invoice_path):
    """Keep the Mini invoice original but repoint its external Partsbook link.

    The invoice formulas use Excel's built-in external workbook link mechanism.
    The original file usually points at "PartsbookBenji2014.xlsx" beside the
    invoice. Once the invoice is copied into final-deliverables, the master is
    no longer beside it, so the Customer Files copy needs an explicit path back
    to data-source/PartsbookBenji2014.xlsx.
    """
    if not invoice_path.exists():
        return

    target = xml_escape(_excel_external_target(MINI_MASTER), {'"': "&quot;"})
    patched_any = False

    with tempfile.NamedTemporaryFile(
        dir=invoice_path.parent,
        prefix=invoice_path.stem + ".",
        suffix=invoice_path.suffix,
        delete=False,
    ) as tmp:
        tmp_path = Path(tmp.name)

    try:
        with zipfile.ZipFile(invoice_path, "r") as zin, zipfile.ZipFile(
            tmp_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)

                if item.filename.startswith("xl/externalLinks/_rels/") and item.filename.endswith(".rels"):
                    text = data.decode("utf-8")

                    def repl(match):
                        nonlocal patched_any
                        relationship = match.group(0)
                        old_target = match.group("target")
                        if "PartsbookBenji2014.xlsx" not in old_target:
                            return relationship
                        patched_any = True
                        return relationship.replace(
                            f'Target="{old_target}"',
                            f'Target="{target}"',
                        )

                    text = re.sub(
                        r'<Relationship\b(?=[^>]*\bType="[^"]*/externalLinkPath")'
                        r'(?=[^>]*\bTarget="(?P<target>[^"]+)")[^>]*/>',
                        repl,
                        text,
                    )
                    data = text.encode("utf-8")

                zout.writestr(item, data)

        if patched_any:
            shutil.move(str(tmp_path), invoice_path)
            print(f"  copied {invoice_path.name} and linked it to {MINI_MASTER.name}")
        else:
            tmp_path.unlink(missing_ok=True)
            print(f"  WARNING: copied {invoice_path.name}, but no Partsbook link was found.")
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


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
    """Copy invoice templates into final-deliverables.

    If an invoice is open in Excel, Windows may lock the destination. In that
    case, warn and keep going because catalogue and website refreshes should
    not be blocked by a working invoice.
    """
    print()
    print("--- Copy original invoice templates ---")
    for src in OPTIONAL_INVOICE_TEMPLATES:
        if not src.exists():
            print(f"  (skipping {src.name} - not present in data-source)")
            continue

        dst = PROJECT_ROOT / "final-deliverables" / src.name
        try:
            shutil.copy2(src, dst)
            if src.name == MINI_INVOICE_NAME:
                point_mini_invoice_at_master(dst)
            else:
                print(f"  copied {src.name} unchanged")
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
