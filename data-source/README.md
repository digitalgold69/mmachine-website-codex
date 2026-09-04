# data-source - owner Excel files

This folder is the source-of-truth folder for the owner's Excel files on the
computer that runs the sync. On a server install, this folder lives on the
server. The Excel files themselves are gitignored, so they stay out of GitHub.

## Required for the daily sync

These two daily master files must be present:

| File | Purpose |
| --- | --- |
| `Metals.xlsx` | Live metals prices and stock/dimension data |
| `PartsbookBenji2014.xlsx` | Master Mini parts prices |

Supporting/template workbooks should live in `More Files`:

| File | Purpose |
| --- | --- |
| `More Files\Metals catalogue 2023.xlsx` | Metals catalogue template/product list |
| `More Files\Mini Catalogue Self Updating.xlsm` | Mini catalogue template/product list |
| `More Files\Mini Invoice Template.xlsm` | Mini invoice template |

The sync reads these files, then regenerates:

- `lib/mini-data.ts`
- `lib/metals-data.ts`
- `final-deliverables/Metals catalogue 2023.xlsx`
- `final-deliverables/Mini Catalogue Self Updating.xlsm`
- catalogue PDFs in `public/catalogue/`

## Metals source of truth

The website metals catalogue uses `More Files\Metals catalogue 2023.xlsx` to
decide which metal rows exist.

`Metals.xlsx` supplies live prices. If a catalogue row no longer has a matching
numeric price in `Metals.xlsx`, the website shows it as `POA` rather than
keeping an old catalogue price.

To fully remove a metal from the website, remove it from
`More Files\Metals catalogue 2023.xlsx`. Removing or blanking only the price in
`Metals.xlsx` leaves the row visible as `POA`.

## Optional invoice templates

This file may also be placed in `More Files`:

| File | Purpose |
| --- | --- |
| `More Files\Metals Invoice.xlsm` | Original metals invoice template |

The metals invoice is copied unchanged into `final-deliverables/`.

The Mini invoice keeps its original layout, macros, and formulas. The sync
embeds fresh Partsbook prices into the customer copy on every run.

## Manual refresh

From the repo root:

```powershell
npm run daily-sync
```

If you only want to refresh the website data:

```powershell
npm run sync-data
```

If you only want to refresh the customer Excel files:

```powershell
npm run sync-excel
```
