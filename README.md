# M-Machine website — Next.js rebuild

A full modern redesign of the M-Machine (Craftgrange Ltd) website, built with Next.js 14, TypeScript, Tailwind CSS and Three.js.

## What's in it

- **Homepage** — hero, catalogue teasers, featured work, trust stats, CTA
- **Mini catalogue** — 768 real products parsed from the PDF, filterable by 3D Mini zone, body type, Mark, and free-text search. Features an **interactive 3D Mini** you can rotate and click to filter panels by body location.
- **Metals catalogue** — 18 sample grades (placeholder — replace with real data when metals PDF is parsed)
- **Featured work** — showcase of bespoke workshop jobs
- **About** — company info
- **Contact** — enquiry form with API endpoint
- **Owner dashboard** — login, product list with search/filter/edit/add, featured work manager
- **SEO** — full metadata, OpenGraph, Twitter cards, sitemap, robots
- **Responsive** — works on mobile

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Three.js (3D Mini)
- React 18

## Running locally (step-by-step)

### 1. Install Node.js

If you don't have it, download the LTS version from https://nodejs.org. Any version 18.17+ works.

### 2. Open a terminal in this folder

On Windows: Shift + Right-click inside the `mmachine` folder → "Open in Terminal"

### 3. Install dependencies

```
npm install
```

This downloads everything the site needs (~1–2 minutes first time).

### 4. Start the dev server

```
npm run dev
```

### 5. Open your browser

Visit **http://localhost:3000**

You should see the homepage with British racing green design, Playfair Display headings, and clickable nav. Try:

- Click "Browse Mini panels" to see the 3D Mini + 768 real products
- Click the bonnet on the 3D Mini — watch the products filter
- Click "Owner login" in nav → Sign in (any email/password) → Dashboard

## Deploying to Vercel (for the owners to see)

This is the fastest path to a shareable URL.

### 1. Push this folder to GitHub

```
git init
git add .
git commit -m "Initial M-Machine site"
git branch -M main
```

Create a new private repo on GitHub called `mmachine-website`, then:

```
git remote add origin https://github.com/YOUR-USERNAME/mmachine-website.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New" → "Project"
3. Import the `mmachine-website` repo
4. Accept all defaults (Vercel auto-detects Next.js)
5. Click "Deploy"

About 2 minutes later you'll have a live URL like `mmachine-website-abc123.vercel.app`. Send that to the owners.

### 3. Iterating

Make changes locally → `git add . && git commit -m "..." && git push` → Vercel auto-redeploys.

## File structure

```
mmachine/
├── app/
│   ├── (site)/          ← public pages (homepage, catalogues, etc.)
│   ├── dashboard/       ← owner dashboard
│   ├── api/             ← API routes (enquiry form, products)
│   ├── layout.tsx       ← root layout + global SEO metadata
│   ├── globals.css      ← Tailwind + brand CSS
│   ├── sitemap.ts       ← auto-generates sitemap.xml
│   └── robots.ts        ← auto-generates robots.txt
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   └── Mini3D.tsx       ← the 3D interactive Mini
├── lib/
│   ├── mini-data.ts     ← 768 real products from the PDF catalogue
│   ├── metals-data.ts   ← metals catalogue (placeholder)
│   └── featured-data.ts ← featured workshop jobs
├── public/              ← static assets (photos, PDFs)
├── tailwind.config.js   ← brand colours + fonts
├── next.config.js
├── package.json
└── tsconfig.json
```

## What's real vs placeholder

**REAL** (parsed from your PDF):
- All 768 Mini products with codes, names, fits, body type, Mark
- All 19 catalogue sections (120, 130, 140… Apx1, Apx2)
- Real prices (ex VAT and inc VAT) from the catalogue
- All section descriptions from the index page

**PLACEHOLDER** (needs to be replaced before launch):
- Stock levels (randomly generated — owners will set real ones in the dashboard)
- Metals catalogue (18 samples — parse the metals PDF to get the real list)
- Featured work images (SVG placeholders — owners will upload photos)
- Login (any email/password works — wire up real auth like NextAuth before launch)
- Enquiry form email (currently just logs to console — wire up Resend/SendGrid)

## Next steps to production

1. **Add a real database** — Supabase PostgreSQL free tier is the fastest. Add `@supabase/supabase-js` and swap the `lib/*-data.ts` files for DB calls.
2. **Real authentication** — NextAuth.js with email/password, or just a simple password-protected dashboard for the owners.
3. **Email for enquiries** — sign up for Resend (free tier: 3000 emails/month), replace the `console.log` in `/api/enquiry` with a real `resend.emails.send()` call.
4. **Image uploads** — Cloudinary free tier, or Vercel Blob.
5. **Parse metals PDF** — use the same Python pdfplumber approach that produced `lib/mini-data.ts`.
6. **Auto-generate PDF catalogue** — use `pdf-lib` or `puppeteer` to regenerate the public PDF from the database.

## Brand system

- **Racing green** (`#0F3D2E`) — primary, backgrounds, primary text
- **Heritage gold** (`#B8860B`) — accents, CTAs, highlights
- **Cream** (`#FBF8F1`) — page background
- **Playfair Display** — headings (elegant serif, hints at heritage)
- **Inter** — body (clean, modern, readable)

---

Built with Claude. Questions? Phone the developer.
