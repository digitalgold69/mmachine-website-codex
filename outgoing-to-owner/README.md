# outgoing-to-owner — fresh files to hand to the owner

This folder is **auto-generated**. Anything in here gets overwritten the
next time you run the Phase 2 sync.

> Files in this folder are **gitignored** — they don't go into the public
> repo. They live here so you can email or share-folder them to the owner
> without them leaking into git.

---

## What's in here after a sync

| File | What it is |
| --- | --- |
| `Metals catalogue 2023.xlsx` | The owner's price catalogue, prices auto-pulled from `data-source/Metals.xlsx` via a hidden `_PriceLookup` tab. Visible `_ReviewMe` tab flags 1,012 rows that didn't auto-link. |
| `Metals Invoice.xlsm` | The owner's invoice template (all macros + Sage workflow preserved) plus a new **visible `_PriceLookup` tab** with 4,604 prices, filterable by Metal / Spec / Size. |
| `Mini Catalogue Self Updating.xlsm` | The owner's Mini parts catalogue, prices auto-pulled from `data-source/PartsbookBenji2014.xlsx` via a hidden `_PriceLookup` tab. No more "Update Links" dialog. |
| `Mini Invoice Template.xlsm` | The owner's Mini invoice template (all macros + 10,034-row address book + tiered pricing system preserved) with five hidden price-lookup tabs (`_PriceLookup`, `_KDMSPC`, `_MSPORT`, `_Magnum`, `_Somerford`). The `AA14` cell still selects between price tiers exactly as before. |

---

## The refresh workflow — one command does everything

Whenever the owner sends an updated `Metals.xlsx`:

```
npm run daily-sync
```

This is a chain of three steps:

1. `npm run sync-data` — regenerates `lib/mini-data.ts` and
   `lib/metals-data.ts` so the website shows the new prices.
2. `npm run sync-excel` — regenerates the two files in this folder
   (the catalogue and invoice ready to email to the owner).
3. `npm run export-pdfs` — uses **Excel's own PDF engine** (via
   PowerShell COM automation) to export the wired catalogue as a PDF
   into `public/catalogue/metals-catalogue.pdf`. This PDF gets served
   to customers from the website and matches the owner's existing
   PDF format byte-for-byte (logo, print settings, headers/footers).

Each of the three is also runnable on its own if you want to do just
one piece (e.g. just the website refresh, no PDF export).

> **Excel must be installed for `npm run export-pdfs`.** LibreOffice
> can't render the M-Machine vector logo cleanly, so we use the same
> Excel that the owner already uses to generate today's PDFs. If you
> only want to refresh website data and the customer-facing files
> (no PDF), use `sync-data` and `sync-excel` only.

---

## What "auto-pulled prices" looks like inside the catalogue

Open `Metals catalogue 2023.xlsx` and click into any price cell on a
metal sheet (e.g. `Alu Angle n Tee` row 3, column E). You'll see a
formula like:

```
=IFERROR(VLOOKUP(K3,_PriceLookup!$A:$F,6,FALSE),0)
```

This means: "Look up the price for this row's metal/spec/size from the
hidden `_PriceLookup` sheet. If not found, show 0."

The owner doesn't need to understand the formula. When you re-run
`npm run sync-excel`, the `_PriceLookup` data is refreshed inside the
file with the latest master prices, and every formula picks up the
new value automatically.

### The two helper tabs in the catalogue

- **`_PriceLookup`** (hidden) — the lookup table. Don't unhide unless
  you need to debug.
- **`_ReviewMe`** (visible) — rows where the wire-up couldn't auto-link
  the catalogue's metal/spec/size to the master with high confidence.
  Sorted with most-suspicious rows first. The owner can decide whether
  to fix the wording in `Metals.xlsx` so they auto-link next sync, or
  leave them with their existing hardcoded prices.

In the latest run: **3,185 rows auto-linked**, **1,012 flagged for
review**. The flagged rows still have their previous hardcoded price —
nothing breaks for the owner if they ignore the `_ReviewMe` sheet.

---

## How the owner uses the price-lookup in the invoice

Open `Metals Invoice.xlsm` and click the **`_PriceLookup`** tab.

1. Click the small filter arrow (▾) on the **Metal** header.
2. Pick (e.g.) `Aluminium`. The list narrows to aluminium rows.
3. Click the filter arrow on **Spec**, type (e.g.) `HE30`, hit Enter.
4. Click the filter arrow on **Size**, type the size, hit Enter.

The matching row shows the price (column E). The owner copies the
price into the invoice line.

The existing invoice formulas (column I = inc-VAT, column J = line
total, the macros, the address book, the Sage Output, the post label)
are **untouched**. Phase 2 only adds a new tab.

---

## What if a sync run fails?

The script stops with a clear error if any of these are missing from
`data-source/`:

- `Metals.xlsx`
- `Metals catalogue 2023.xlsx`
- `Metals Invoice.xlsm`

If you see "Permission denied" on Windows, close any of those files in
Excel before re-running.
