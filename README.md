# SupplementSmarter

<p align="center">
  <img src="public/README.gif" alt="SupplementSmarter demo" width="900" />
</p>

<p align="center">
  🔗 <a href="https://www.supplement-smarter.com/">https://www.supplement-smarter.com/</a>
</p>

**SupplementSmarter** is a price-tracking + comparison app for supplements (starting with **protein** and **creatine**) built as a production-style full-stack project

It combines a product browsing UI with a backend pipeline that **scrapes retailer listings**, **normalises product data**, and serves ranked results (value-first) plus **price history** and **all-time low** summaries

- 4 retailers (SprintFit, NoWhey, Xplosiv, NZProtein)
- Daily scrape via cron (~03:00 NZT) -> Postgres -> Rebuild read tables
- 24,683 raw listing snapshots in `public.scraped_products`
- Canonical identity: `(category, brand_normalised, product_normalised, weight_grams)` (+ flavour normalisation)
- Continues on single-retailer timeout/block; rebuilds from available sources and refreshes fully on next successful scrape

---

## Problem & Approach

Supplement shopping is messy:

- retailer listings vary in naming/weights/flavours
- “cheap” isn’t always “best value”
- it’s hard to know if a price is actually good without history

SupplementSmarter addresses this by:

- scraping multiple NZ retailers into a consistent format
- normalising + filtering into category-specific tables
- ranking by **value score** (then price)
- showing **offers**, **price history**, and **all-time low / current low** for a product

<p align="center">
  <img src="public/README_2.gif" alt="SupplementSmarter demo" width="900" />
</p>

---

## Core Capabilities

- Protein + Creatine category pages, ranked by value
- Search suggestions across categories
- Product pages with:
  - current offers (per retailer)
  - price history timeline
  - all-time low + current low summaries
- Daily scrape + normalisation pipeline
- Automated tests (unit + API + scraper checks)

---

## Docs

- Architecture: `docs/architecture.md`
- Schema (PDF): `docs/schema/schema.pdf`
- Deploy: `docs/deploy.md`
- Normalisation & matching: `docs/normalisation_matching.md`
- Value score: `docs/value_score.md`

---

## Numbers (production)

- Retailers: 4 (SprintFit, NoWhey, Xplosiv, NZProtein)
- Raw listing snapshots: 24,683 rows in `public.scraped_products`
- In-stock at scrape-time: 94.7%
- Scheduled ingestion: daily cron (~03:00 NZT)

---

## Tech Stack

**Frontend:** Vite + React + TypeScript, Tailwind  
**Backend:** Node.js + Express (TypeScript via `tsx`), PostgreSQL  
**Pipeline:** Playwright/Cheerio scrapers + SQL normalisation + read-optimised tables

---

## API (high-level)

- `GET /health`
- `GET /api/protein` (+ `/suggest`, `/:slug`)
- `GET /api/creatine` (+ `/suggest`, `/:slug`)
- `GET /api/supplements/suggest?q=...`

---

## Tests

From `server/`:

```bash
npm run test        # run everything
npm run test:watch  # dev watch mode

npm run test:unit   # unit tests
npm run test:api    # API integration tests
npm run test:scrape # scraper tests
npm run test:ci     # what CI runs (unit + api)
```

---

## License

MIT License
