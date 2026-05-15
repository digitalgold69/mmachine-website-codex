# data-source - owner Excel files

This folder is the local source-of-truth folder for the owner's Excel files.
The Excel files themselves are gitignored, so they stay on the owner's machine.

## Required for the daily sync

These four files must be present:

| File | Purpose |
| --- | --- |
| `Metals.xlsx` | Master metals prices |
| `PartsbookBenji2014.xlsx` | Master Mini parts prices |
| `Metals catalogue 2023.xlsx` | Metals catalogue template/product list |
| `Mini Catalogue Self Updating.xlsm` | Mini catalogue template/product list |

The sync reads these files, then regenerates:

- `lib/mini-data.ts`
- `lib/metals-data.ts`
- `final-deliverables/Metals catalogue 2023.xlsx`
- `final-deliverables/Mini Catalogue Self Updating.xlsm`
- catalogue PDFs in `public/catalogue/`

## Optional invoice templates

These two files may also be placed here:

| File | Purpose |
| --- | --- |
| `Metals Invoice.xlsm` | Original metals invoice template |
| `Mini Invoice Template.xlsm` | Original Mini invoice template |

The metals invoice is copied unchanged into `final-deliverables/`.

The Mini invoice keeps its original layout, macros, and formulas. The sync only
updates its existing external workbook link so code-entry prices come from the
current `PartsbookBenji2014.xlsx` in this source folder.

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
