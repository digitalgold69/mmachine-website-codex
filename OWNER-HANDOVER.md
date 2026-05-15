# M-Machine — your new website setup

Welcome. This document explains everything you need to know about the
website and how it stays up to date. Keep it somewhere handy — you can
print it if you like.

---

## The short version

You only need to do **one thing** for your prices to stay up to date on
the website and your customer-facing files:

> **After editing `Metals.xlsx` or `PartsbookBenji2014.xlsx`, drop them
> into the folder on your desktop called "M-Machine Master Files".**

Everything else — the website, the catalogue, the invoice — updates
itself overnight. There is nothing else to learn. You don't need to send
files to anyone, type prices into multiple places, or click any buttons.

---

## The folder on your desktop

After your setup visit, you'll see a folder on your desktop called:

> 📁 **M-Machine Master Files**

This is the **only place** you need to know about. To Windows it's a
shortcut into the website's internal storage, but to you it's just a
folder. You open it, drop files into it, that's it.

What goes inside:

| File | What it's for |
| --- | --- |
| `Metals.xlsx` | Your master metals price list |
| `PartsbookBenji2014.xlsx` | Your master Mini parts price list |
| `Mini Catalogue Self Updating.xlsm` | Your Mini catalogue template (you mostly don't edit this) |
| `Metals catalogue 2023.xlsx` | Your metals catalogue template (you mostly don't edit this) |
| `Metals Invoice.xlsm` | Your metals invoice template (you mostly don't edit this) |
| `Mini Invoice Template.xlsm` | Your Mini invoice template (you mostly don't edit this) |

Every weekday at **12:00 noon UK time**, the computer reads these files
and refreshes everything: the website, the wired catalogue and invoice
files in your Customer Files desktop folder, and the catalogue PDFs.

The time follows GMT/BST automatically — you don't have to do anything
when the clocks change.

---

## Daily workflow — updating prices

### If you're at the work PC:

1. Open the **M-Machine Master Files** folder on your desktop
2. Double-click `Metals.xlsx` (or `PartsbookBenji2014.xlsx`)
3. Edit prices wherever you like
4. Save. Close Excel.
5. Done. The website + your customer-facing files refresh at noon today.

### If you took the files home on a USB stick:

1. Edit the files on your home laptop. Save them on the USB.
2. Bring the USB back, plug it into the work PC.
3. Open the USB folder in Windows Explorer.
4. **Drag the edited file(s) onto the "M-Machine Master Files" folder on your desktop.**
5. Windows asks "Replace the file?" → click **Yes**.
6. Done. Same as above — everything refreshes at noon.

That's the whole routine. No file paths to remember, no commands, no emails.

---

## Adding a new customer to the address book

The address book (in the **Metals Invoice** and **Mini Invoice** files)
is part of the **template**. Edit it from the **Master Files** folder,
not the Customer Files folder:

1. Open **Master Files** folder on your desktop
2. Double-click `Metals Invoice.xlsm` (or the Mini Invoice)
3. Add the new customer to the **Address Book** tab as usual
4. Save. Close Excel.
5. From the next noon sync onwards, the customer is available in the
   regenerated invoice in your **Customer Files** folder.

> **If you need to invoice that customer SAME DAY, BEFORE the noon sync:**
> Add the address to the Master Files version AND the Customer Files
> version. The Master Files version makes it permanent for tomorrow; the
> Customer Files version lets you use it today.

---

## Where the price-lookups live in your customer files

A nice change from before: **the "Update Links" dialog is gone**. The
catalogue and invoice files now contain their own private copy of the
master prices, refreshed every night.

### `Metals catalogue 2023.xlsx`
Open it and the prices are already there — no dialog, no "yes/no" prompt.
Two new tabs at the bottom:

- **`_PriceLookup`** (hidden) — the price table. Don't unhide unless Guy
  asks you to.
- **`_ReviewMe`** (visible) — a list of rows where the wording in the
  catalogue doesn't quite match the wording in `Metals.xlsx`, so the
  auto-link skipped them. They keep their existing hardcoded price.
  You can ignore this sheet entirely, OR work through it slowly to clean
  up your master file so more rows auto-link next time.

### `Metals Invoice.xlsm`
Open it the same way you always have. New tab at the bottom called
**`_PriceLookup`** with all 4,604 prices, filterable.

When you're filling in an invoice line and need to look up a price:

1. Click the `_PriceLookup` tab at the bottom
2. Click the small filter arrow (▾) on the **Metal** column header
3. Pick (e.g.) Aluminium
4. Click the filter arrow on **Spec**, type `HE30`, hit Enter
5. Click the filter arrow on **Size**, type the size, hit Enter
6. Read off the price in column E
7. Click the `Invoice` tab at the bottom and type the price in

(Your old workflow of cross-referencing Metals.xlsx still works too —
this is just an alternative that's quicker for many lookups.)

### `Mini Catalogue Self Updating.xlsm`
Open it. No "Update Links" dialog. Prices are baked in via a hidden
`_PriceLookup` tab, refreshed nightly.

### `Mini Invoice Template.xlsm`
Open it normally. The tiered pricing system you've always used (cell
`AA14` = 1 retail, 2 KDMSPC, 3 MSPORT, 4 Magnum, 5 Somerford) still
works exactly as before. The five price lists are now stored inside the
file as hidden tabs (`_PriceLookup`, `_KDMSPC`, `_MSPORT`, `_Magnum`,
`_Somerford`), refreshed nightly.

---

## Updating featured workshop jobs (the in-browser editor)

You no longer need to send Guy photos or details when you want to add a
new bespoke job to the website's "Featured work" page. You can do it
yourself in your browser.

### How to sign in

1. Open your browser. Go to:

   `https://mmachine-website.vercel.app/dashboard/login`

   (Bookmark this — you'll come back to it whenever you want to update
   featured work.)

2. Type the password Guy gave you. Click **Sign in**.

3. You'll land on the owner dashboard. Click **Featured work** in the menu.

### How to add a new featured job

1. Click **+ Add new job** (top right).
2. Fill in:
   - **Job title** — short and snappy, e.g. "Aluminium bonnet scoop"
   - **Tag** — pick from the dropdown (Bespoke, Fabrication, etc.)
   - **Year** — the year you completed the job
   - **Category** — what kind of work it was
   - **Short description** — one or two sentences
   - **Full story** — the longer write-up if you have one
   - **Photo** — click "Choose File" and pick a photo from your computer.
     JPG, PNG, or WebP. Under 5 MB.
3. Click **Save**.
4. A green banner says "Saved — public site updates within a minute."
5. Wait a minute, then refresh the live website to see your new job.

### How to edit an existing job

1. On the Featured work page, click **Edit** on the card for the job you
   want to change.
2. Make your changes. Replace the photo if you like.
3. Click **Save**.

### How to delete a job

1. Click **Delete** on the card. Confirm.
2. Gone. Public site updates within a minute.

### How to sign out

Click **Sign out** in the top right of the dashboard.

---

## What if something goes wrong

**The website hasn't updated this morning.**

The overnight refresh probably didn't run. Common reasons:
- Your computer was switched off at 6 AM
- Excel was open with one of the files at 6 AM (Excel locks files while open)
- Internet was disconnected

Fix: turn the computer on, make sure Excel isn't holding any of the
files open, and either wait until tomorrow or ask Guy to run the
refresh manually.

**An "Update Links" dialog appears when I open a file.**

This shouldn't happen. If it does:

- Click **Don't Update**
- Save the file (Ctrl+S)
- Close it
- Tell Guy — there's likely a fix needed on his end

**I forgot the dashboard password.**

Ask Guy. He can reset it without affecting anything else.

**I made a mistake editing a featured job.**

Sign back into the dashboard and edit/delete the job. Changes go live
within a minute.

**A row I'd expect to see on the website is missing.**

The website only shows parts that appear in BOTH:
1. A master file (so it has a price), AND
2. A customer-facing catalogue (so customers know about it)

If a part is missing from the website, check it's in BOTH files.

**The website shows "POA" instead of a price.**

That part exists in your customer-facing catalogue but not (yet) in the
master file. Add it to `PartsbookBenji2014.xlsx` (with a price) or
`Metals.xlsx` (with a price), save, and the price will appear on the
website tomorrow morning.

---

## What NOT to do

These will cause headaches — please avoid them:

❌ **Don't edit prices in `final-deliverables/`** — those files are
overwritten every night. Your changes will be lost.

❌ **Don't edit prices in the customer-facing catalogue or invoice files
directly** — same problem. Always change prices in `Metals.xlsx` or
`PartsbookBenji2014.xlsx`.

❌ **Don't move or rename files in `C:\mmachine`** — the system expects
specific filenames in specific folders.

❌ **Don't delete the `_PriceLookup`, `_KDMSPC`, etc. tabs** in your
customer-facing files — those are how the prices stay current.

❌ **Don't share your dashboard password with anyone** — anyone with the
password can edit the website. If you need to give someone temporary
access, ask Guy to set up a separate account.

---

## Things you CAN edit anywhere

- **Master prices** in `Metals.xlsx` and `PartsbookBenji2014.xlsx` (the
  main thing)
- **Featured workshop jobs** via the in-browser dashboard
- **Customer-facing catalogue/invoice files** in `final-deliverables` —
  but only if you're filling in a one-off invoice or marking up your own
  copy. Any price changes will be overwritten by the next nightly refresh.

---

## Working from your home laptop

If you take `Metals.xlsx` home on a USB stick, edit it on your laptop,
and bring it back: **copy the edited file BACK into
`C:\mmachine\data-source` when you return** (overwriting the existing
one). The next nightly refresh picks it up.

A nicer alternative — Guy can set up `data-source` as a OneDrive folder
so the file syncs automatically between your work computer and your
laptop. Ask him about this if it sounds useful.

---

## Who to call

If anything stops working, breaks, or looks wrong: **call Guy first.**
Most issues take a few minutes to fix on his end and don't require any
action from you.

Don't try to fix things by editing files in folders you don't normally
edit, even if it looks tempting — calling Guy is always faster.

---

*This document covers everything you need for normal use. If you discover
something it doesn't cover, write it down and tell Guy so he can update
this guide for next time.*
