# final-deliverables — the canonical updated files

The four files here are the **latest, canonical versions** to send to the
owner. They have plain filenames (no "v1/v2/(surgical)" suffixes) so
there's no confusion about which one is current.

Every time you run `npm run sync-excel` (or the daily-sync), these get
overwritten with fresh copies that match the latest master prices.

| File | What's inside |
| --- | --- |
| `Metals catalogue 2023.xlsx` | Metals catalogue with prices auto-pulled from `Metals.xlsx` via a hidden `_PriceLookup` tab. Visible `_ReviewMe` flags 1,012 rows that need owner attention. |
| `Metals Invoice.xlsm` | Metals invoice template with macros + Sage workflow preserved. New visible `_PriceLookup` tab with 4,604 prices, filterable. |
| `Mini Catalogue Self Updating.xlsm` | Mini parts catalogue. External-link "Update Links" dialog gone — prices come from internal `_PriceLookup` (refreshed each sync from `PartsbookBenji2014.xlsx`). |
| `Mini Invoice Template.xlsm` | Mini invoice template. Macros + 10,034-row address book + tiered pricing (`AA14` cell still picks between Parts Data / KDMSPC / MSPORT / Magnum / Somerford). All five price lists embedded as hidden internal sheets. |

> The older versioned files in `outgoing-to-owner/` are kept around for
> diffing against earlier attempts, but **send these four files** to the
> owner. After the daily sync is set up on her machine, she'll have her
> own copies that auto-refresh — at that point this folder becomes a
> staging area for the developer rather than a delivery target.
