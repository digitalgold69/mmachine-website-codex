#!/usr/bin/env python3
"""Export the two customer catalogues through a headless LibreOffice process."""

from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

import uno
from com.sun.star.beans import PropertyValue


def property_value(name: str, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


def set_header(page_style, value: str) -> None:
    for property_name in (
        "RightPageHeaderContent",
        "LeftPageHeaderContent",
        "FirstPageHeaderContent",
    ):
        content = page_style.getPropertyValue(property_name)
        content.CenterText.String = value
        page_style.setPropertyValue(property_name, content)


def connect_to_libreoffice(port: int, timeout_seconds: int = 30):
    local_context = uno.getComponentContext()
    resolver = local_context.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver",
        local_context,
    )
    deadline = time.monotonic() + timeout_seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            context = resolver.resolve(
                f"uno:socket,host=127.0.0.1,port={port};"
                "urp;StarOffice.ComponentContext"
            )
            return context.ServiceManager.createInstanceWithContext(
                "com.sun.star.frame.Desktop",
                context,
            )
        except Exception as error:
            last_error = error
            time.sleep(0.5)
    raise RuntimeError(
        f"LibreOffice did not become ready on port {port}: {last_error}"
    )


def open_workbook(desktop, source: Path):
    return desktop.loadComponentFromURL(
        uno.systemPathToFileUrl(str(source)),
        "_blank",
        0,
        (
            property_value("Hidden", True),
            property_value("ReadOnly", True),
            property_value("UpdateDocMode", 3),
        ),
    )


def export_pdf(document, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    document.calculateAll()
    document.storeToURL(
        uno.systemPathToFileUrl(str(output)),
        (
            property_value("FilterName", "calc_pdf_Export"),
            property_value("Overwrite", True),
        ),
    )


def prepare_metals(document) -> None:
    page_styles = document.StyleFamilies.getByName("PageStyles")
    year = datetime.now().year
    month_names = (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    )
    now = datetime.now()
    document.Sheets.getByName("Front sheet").getCellRangeByName("A19").String = (
        f"{month_names[now.month - 1]} {year}"
    )

    default_scale = 96
    scale_overrides = {
        "St St Dia sq hex": 100,
        "Steel Diameter": 100,
    }
    unscaled_sheets = {
        "Front sheet",
        "T&Cs",
        "Conversion table",
        "Carriage Rates",
    }

    for index in range(document.Sheets.Count):
        sheet = document.Sheets.getByIndex(index)
        if not sheet.IsVisible:
            continue

        page_style = page_styles.getByName(sheet.PageStyle)
        if sheet.Name != "Front sheet":
            set_header(page_style, f"Metals Catalogue {year}")
        if sheet.Name not in unscaled_sheets:
            page_style.PageScale = scale_overrides.get(sheet.Name, default_scale)


def export_catalogue(desktop, source: Path, output: Path, is_metals: bool) -> None:
    if not source.exists():
        raise FileNotFoundError(f"Catalogue source not found: {source}")

    document = open_workbook(desktop, source)
    if document is None:
        raise RuntimeError(f"LibreOffice could not open: {source}")

    try:
        if is_metals:
            prepare_metals(document)
        export_pdf(document, output)
    finally:
        document.close(True)


def main() -> int:
    if len(sys.argv) != 6:
        print(
            "Usage: export_pdfs_libreoffice.py "
            "<port> <metals-source> <metals-output> <mini-source> <mini-output>",
            file=sys.stderr,
        )
        return 2

    port = int(sys.argv[1])
    metals_source = Path(sys.argv[2]).resolve()
    metals_output = Path(sys.argv[3]).resolve()
    mini_source = Path(sys.argv[4]).resolve()
    mini_output = Path(sys.argv[5]).resolve()

    desktop = connect_to_libreoffice(port)
    try:
        export_catalogue(desktop, metals_source, metals_output, is_metals=True)
        export_catalogue(desktop, mini_source, mini_output, is_metals=False)
        print("LibreOffice catalogue PDF export completed")
    finally:
        desktop.terminate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
