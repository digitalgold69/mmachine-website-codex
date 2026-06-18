#!/usr/bin/env python3
"""Disposable end-to-end regression test for price/add/remove sync behavior."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def run(command, cwd):
    result = subprocess.run(command, cwd=cwd)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {command}")


def read_array(path: Path, marker: str):
    source = path.read_text(encoding="utf-8")
    start = source.index(marker)
    start = source.index("=", start) + 1
    start = source.index("[", start)
    return json.JSONDecoder().raw_decode(source[start:])[0]


def prepare_sandbox(root: Path) -> None:
    for folder in ("scripts", "data-source"):
        shutil.copytree(PROJECT_ROOT / folder, root / folder)
    (root / "lib").mkdir()
    for name in ("mini-data.ts", "metals-data.ts"):
        shutil.copy2(PROJECT_ROOT / "lib" / name, root / "lib" / name)
    (root / "public" / "catalogue").mkdir(parents=True)
    (root / "final-deliverables").mkdir()


def verify(root: Path, mini_info, metal_info) -> None:
    changed_code, removed_code, added_code = mini_info
    mini = read_array(root / "lib" / "mini-data.ts", "export const products")
    by_code = {item["code"]: item for item in mini}
    assert by_code[changed_code]["priceExVat"] == 50
    assert removed_code not in by_code
    assert by_code[added_code]["priceExVat"] == 12.34

    metals = read_array(root / "lib" / "metals-data.ts", "export const metals")
    changed = [
        item for item in metals
        if item["size"] == "16mm x 16mm x 3mm"
        and item["metal"] == "Steel"
    ]
    assert changed and changed[0]["priceExVat"] == 30
    added = [item for item in metals if item["size"] == "99mm x 77mm x 3mm"]
    assert added and added[0]["priceExVat"] == 19.87
    removed_signature = metal_info
    assert not any(
        (item["form"], item["metal"], item["spec"], item["size"]) == removed_signature
        for item in metals
    )


def main():
    with tempfile.TemporaryDirectory(prefix="mmachine-sync-test-") as temp:
        root = Path(temp)
        prepare_sandbox(root)
        run([
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(root / "scripts" / "test_mutate_workbooks.ps1"),
            "-Root",
            str(root),
        ], root)
        mini_info = ("11.14.00.87", "11.14.00.88", "SYNC-TEST-MINI")
        metal_info = ("Diameter", "Aluminium", "HE30", '3/4" D')

        run([sys.executable, "scripts/regen_website_data.py"], root)
        run([sys.executable, "scripts/phase2/sync_phase2.py"], root)
        run([
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "scripts/phase2/export_pdfs.ps1",
        ], root)
        run([sys.executable, "scripts/validate_sync.py"], root)
        verify(root, mini_info, metal_info)
        print("PASS: price changes, additions, and removals propagated end to end")


if __name__ == "__main__":
    main()
