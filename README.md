# M-Machine website â€” Next.js rebuild

A full modern redesign of the M-Machine (Craftgrange Ltd) website, built with Next.js 14, TypeScript, Tailwind CSS and Three.js.

## What's in it

- **Homepage** â€” hero, catalogue teasers, featured work, trust stats, CTA
- **Mini catalogue** â€” 768 real products parsed from the PDF, filterable by 3D Mini zone, body type, Mark, and free-text search. Features an **interactive 3D Mini** you can rotate and click to filter panels by body location.
- **Metals catalogue** â€” 18 sample grades (placeholder â€” replace with real data when metals PDF is parsed)
- **Featured work** â€” showcase of bespoke workshop jobs
- **About** â€” company info
- **Contact** â€” enquiry form with API endpoint
- **Owner dashboard** â€” login, product list with search/filter/edit/add, featured work manager
- **SEO** â€” full metadata, OpenGraph, Twitter cards, sitemap, robots
- **Responsive** â€” works on mobile

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

On Windows: Shift + Right-click inside the `mmachine` folder â†’ "Open in Terminal"

### 3. Install dependencies

```
npm install
```

This downloads everything the site needs (~1â€“2 minutes first time).

### 4. Start the dev server

```
npm run dev
```

### 5. Open your browser

Visit **http://localhost:3000**

You should see the homepage with British racing green design, Playfair Display headings, and clickable nav. Try:

- Click "Browse Mini panels" to see the 3D Mini + 768 real products
- Click the bonnet on the 3D Mini â€” watch the products filter
- Click "Owner login" in nav â†’ Sign in (any email/password) â†’ Dashboard

## Deploying to Cloudflare

The working site is deployed to Cloudflare Workers with OpenNext. Runtime dashboard data uses Cloudflare D1, and featured-work images use Cloudflare R2.

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

### 2. Connect to Cloudflare Workers

1. Go to https://dash.cloudflare.com and sign in
2. Open Workers & Pages
3. Import the `mmachine-website` repo
4. Use the Cloudflare build/deploy commands in CLOUDFLARE-DEPLOYMENT.md
5. Click "Deploy"

Cloudflare provides a temporary workers.dev URL first. Attach the real domain when the owners approve the working version.

### 3. Iterating

Make changes locally â†’ `git add . && git commit -m "..." && git push` â†’ Cloudflare auto-redeploys.

## File structure

```
mmachine/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ (site)/          â† public pages (homepage, catalogues, etc.)
â”‚   â”œâ”€â”€ dashboard/       â† owner dashboard
â”‚   â”œâ”€â”€ api/             â† API routes (enquiry form, products)
â”‚   â”œâ”€â”€ layout.tsx       â† root layout + global SEO metadata
â”‚   â”œâ”€â”€ globals.css      â† Tailwind + brand CSS
â”‚   â”œâ”€â”€ sitemap.ts       â† auto-generates sitemap.xml
â”‚   â””â”€â”€ robots.ts        â† auto-generates robots.txt
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ Navbar.tsx
â”‚   â”œâ”€â”€ Footer.tsx
â”‚   â””â”€â”€ Mini3D.tsx       â† the 3D interactive Mini
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ mini-data.ts     â† 768 real products from the PDF catalogue
â”‚   â”œâ”€â”€ metals-data.ts   â† metals catalogue (placeholder)
â”‚   â””â”€â”€ featured-data.ts â† featured workshop jobs
â”œâ”€â”€ public/              â† static assets (photos, PDFs)
â”œâ”€â”€ tailwind.config.js   â† brand colours + fonts
â”œâ”€â”€ next.config.js
â”œâ”€â”€ package.json
â””â”€â”€ tsconfig.json
```

## What's real vs placeholder

**REAL** (parsed from your PDF):
- All 768 Mini products with codes, names, fits, body type, Mark
- All 19 catalogue sections (120, 130, 140â€¦ Apx1, Apx2)
- Real prices (ex VAT and inc VAT) from the catalogue
- All section descriptions from the index page

**PLACEHOLDER** (needs to be replaced before launch):
- Stock levels (randomly generated â€” owners will set real ones in the dashboard)
- Metals catalogue (18 samples â€” parse the metals PDF to get the real list)
- Featured work images (SVG placeholders â€” owners will upload photos)
- Login (any email/password works â€” wire up real auth like NextAuth before launch)
- Enquiry form email (currently just logs to console â€” wire up Resend/SendGrid)

## Next steps to production

1. **Cloudflare D1** - stores quote requests, order history, and featured-work rows.
2. **Real authentication** â€” NextAuth.js with email/password, or just a simple password-protected dashboard for the owners.
3. **Email for enquiries** â€” sign up for Resend (free tier: 3000 emails/month), replace the `console.log` in `/api/enquiry` with a real `resend.emails.send()` call.
4. **Cloudflare R2** - stores featured-work image uploads.
5. **Parse metals PDF** â€” use the same Python pdfplumber approach that produced `lib/mini-data.ts`.
6. **Auto-generate PDF catalogue** â€” use `pdf-lib` or `puppeteer` to regenerate the public PDF from the database.

## Brand system

- **Racing green** (`#0F3D2E`) â€” primary, backgrounds, primary text
- **Heritage gold** (`#B8860B`) â€” accents, CTAs, highlights
- **Cream** (`#FBF8F1`) â€” page background
- **Playfair Display** â€” headings (elegant serif, hints at heritage)
- **Inter** â€” body (clean, modern, readable)

---

Built with Claude. Questions? Phone the developer.

