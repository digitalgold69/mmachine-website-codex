# M-Machine website and catalogue handover

This setup keeps the owner's normal Excel routine intact.

## The short version

To update prices, edit the master Excel files in the desktop folder named:

```text
M-Machine Master Files
```

Save the file and close Excel. The daily sync refreshes the website, catalogue
files, and downloadable PDFs.

The invoice templates stay original. They are not redesigned. The only invoice
link the sync touches is the Mini invoice's existing Partsbook link, so code
entry keeps pulling prices from the current Mini master file.

## Desktop folders

### M-Machine Master Files

This is where the source Excel files live.

Required files:

- `Metals.xlsx`
- `PartsbookBenji2014.xlsx`
- `Metals catalogue 2023.xlsx`
- `Mini Catalogue Self Updating.xlsm`

Optional invoice templates:

- `Metals Invoice.xlsm`
- `Mini Invoice Template.xlsm`

### M-Machine Customer Files

This is where refreshed customer files appear after the sync.

It contains:

- refreshed `Metals catalogue 2023.xlsx`
- refreshed `Mini Catalogue Self Updating.xlsm`
- unchanged copy of `Metals Invoice.xlsm`, if present in Master Files
- original `Mini Invoice Template.xlsm`, linked to the current `PartsbookBenji2014.xlsx`, if present in Master Files

## Daily price workflow

1. Open `M-Machine Master Files`.
2. Open `Metals.xlsx` or `PartsbookBenji2014.xlsx`.
3. Change prices.
4. Save.
5. Close Excel.
6. The daily sync refreshes the website and catalogue files.

## Manual refresh

If Guy needs to run it immediately:

```powershell
cd C:\mmachine
npm run daily-sync
```

## What updates automatically

- website product data
- online Mini catalogue prices
- online metals catalogue prices
- refreshed customer catalogue Excel files
- downloadable catalogue PDFs
- Mini invoice code-entry prices, through its existing link to `PartsbookBenji2014.xlsx`

## What does not change

- The metals invoice layout
- The Mini invoice layout
- The invoice macros
- The owner's familiar invoice workflow

The metals invoice is copied unchanged from Master Files to Customer Files. The
Mini invoice is copied with the same layout, macros, and formulas, but its
existing Partsbook link is pointed at the current master file.

## If something looks wrong

Check:

1. Excel is closed.
2. The required files are in `M-Machine Master Files`.
3. The file names exactly match the names above.
4. The log file has the latest error:

```text
C:\mmachine\daily-sync.log
```

If the website has not updated, the computer may have been off, Excel may have
been open, or the internet may have been disconnected during the scheduled run.
