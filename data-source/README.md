# data-source — master Excel files for the website

This folder is where the **master Excel files** live so the website can pull
prices and parts from them.

> Files in this folder are **gitignored**. They never leave your machine.
> Only the regenerated `lib/mini-data.ts` and `lib/metals-data.ts` get
> committed to the repo (and pushed to the live site).

---

## Files this folder needs

| File | Required? | What it's for |
| --- | --- | --- |
| `PartsbookBenji2014.xlsx` | **Yes** | Master Mini parts list. Sheet `Parts Data` is the source. |
| `Metals.xlsx` | **Yes** | Master metals list. Every metal sheet is read. |
| `Mini Catalogue Self Updating.xlsm` | Optional | Used to figure out which parts belong in the Apx1/Apx2 catalogue sections. Without it, those two sections will be empty on the website. |
| `Metals catalogue 2023.xlsx` | Phase 2 only | The owner's master catalogue. Re-priced into `outgoing-to-owner/` by `npm run sync-excel`. |
| `Metals Invoice.xlsm` | Phase 2 only | The owner's master invoice (preserves VBA). Gets a filterable `_PriceLookup` tab added in `outgoing-to-owner/`. |

If `data-source/` is empty or missing one of the required files, the sync
script stops with a clear error and **does not touch the website data**.

---

## How to refresh the website with the latest prices

1. Drop the latest copies of the three Excel files into this folder
   (overwrite whatever's there).
2. Open a terminal in the repo root (the `mmachine` folder).
3. Run:

   ```
   npm run sync-data
   ```

4. The script prints a summary like:

   ```
   ✓ Mini products: 759 (skipped 2415 non-catalogue rows)
   ✓ Metals products: 4897
   ✓ Wrote lib/mini-data.ts
   ✓ Wrote lib/metals-data.ts
   ✓ Done. Refresh your browser to see the changes.
   ```

5. Refresh your browser tab — the new prices and parts are now live in
   the dev site.

6. To push the change live to the public site:

   ```
   git add lib/mini-data.ts lib/metals-data.ts
   git commit -m "Refresh catalogue from Excel"
   git push
   ```

   Vercel deploys the change automatically once pushed.

---

## How data flows from Excel to the website

The architecture (after the Phase 2 flip):

- **What the website shows** comes from the customer-facing docs:
  - Mini products → `Mini Catalogue Self Updating.xlsm` (B-sheets +
    APX1/APX2 — same parts the owner sends customers in PDF form)
  - Metals products → `Metals catalogue 2023.xlsx` (every metal-sheet row)
- **Prices** come from the master files:
  - `PartsbookBenji2014.xlsx` for Mini parts (looked up by part code)
  - `Metals.xlsx` for metals (looked up by metal/spec/size with fuzzy
    matching for the cases where the catalogue and master don't use
    identical wording)

So to add a new product to the website: the owner adds it to BOTH a
master file (so it has a price) AND the customer-facing catalogue (so
customers see it on the website and in the PDF).

## Things that get filled in automatically

When the script reads an Excel row, it figures out:

- **section** — from which sheet the part lives in (e.g. `120B` → section
  120, `APX1` → Apx1).
- **price including VAT** — calculated as price × 1.20.
- **bodyType / mark / hand** — best-effort parsed from the description
  text (e.g. "Door Skin LH Mk1-2" → `LH assembly`, `Mark 1-2`).
- **stock** — "in" if a master price was found, "out" if not (treated as
  POA — Price On Application). Real stock tracking comes in Phase 3.

---

## Things that are **not** auto-pulled (Phase 1 limits)

- Stock counts. The Excel doesn't track stock, so every part shows "in
  stock" until we wire up the online inventory in Phase 3.
- Section labels and subtitles. These come from the printed PDF
  catalogue and are baked into the sync script. If the catalogue
  reorganises sections, edit `scripts/sync-data.mjs` (the `SECTIONS`
  array near the top).
- Featured workshop images on the homepage — those are still in
  `lib/featured-data.ts` and edited by hand.

---

## What if I edit `lib/mini-data.ts` by hand?

**Don't.** It says `AUTO-GENERATED` at the top for a reason — the next
`npm run sync-data` will overwrite your edits. Make changes in the
Excel file, then re-run the script.
