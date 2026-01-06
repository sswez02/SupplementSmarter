# SupplementSmarter - Architecture

This document shows the **request path** (user to UI to API to DB) and the **ingestion path** (cron to scrapers to raw snapshots to SQL normalisation/build to read-optimised tables)

---

## High-level system diagram

```mermaid
flowchart LR
  subgraph C["Client"]
    U["User (Browser)"]
    FE["Vite + React + TypeScript + Tailwind<br/>Browsing-first UI<br/>• Category tables (ranked)<br/>• Search suggestions<br/>• Product detail + price history"]
    U --> FE
  end

  subgraph AWS["AWS EC2 (Ubuntu)"]
    direction LR

    subgraph APP["App Layer"]
      PM2["PM2<br/>process: supplement-api (fork)"]
      API["Node.js + Express API (TypeScript via tsx)<br/>Read-focused endpoints:<br/>• /health<br/>• /protein<br/>• /creatine<br/>• /suggest<br/>• /products/:slug"]
      PM2 --> API
    end

    subgraph PG["PostgreSQL on EC2"]
      RAW[(public.scraped_products<br/>Raw listing snapshots)]
      NORM["Normalised / alias / mapping tables<br/>brand + flavour + name cleanup<br/>pg_trgm similarity matching"]
      FINAL["Read-optimised category + product tables<br/>Value score + ranking<br/>Price history + lows summaries"]
    end

    subgraph PIPE["Ingestion + Build Pipeline"]
      CRON["Cron (daily ~03:00 NZT)<br/>Runs: npm run db:reset-and-scrape"]
      JOB["db:reset-and-scrape<br/>Orchestrator"]
      LOGS["logs/db-reset-and-scrape.log<br/>stdout/stderr append"]
      SQL["SQL normalisation + build steps<br/>• standardise names/brands/units<br/>• unify canonical products<br/>• compute value score<br/>• compute history + lows"]

      CRON --> JOB
      JOB --> LOGS
      JOB --> SQL
      SQL --> RAW
      SQL --> NORM
      SQL --> FINAL
    end

    API --> FINAL
  end

  subgraph NET["Public Internet"]
    direction TB
    R1["SprintFit"]
    R2["NoWhey"]
    R3["Xplosiv"]
    R4["NZProtein"]
  end

  subgraph SCRAPE["Scrapers"]
    direction TB
    CH["Cheerio scrapers<br/>(HTTP fetch + HTML parse)"]
    PW["Playwright scrapers<br/>(dynamic sites / variants)"]
    SAFE["Operational safety<br/>• continue on retailer failure<br/>• recycle browser contexts<br/>• bounded resources"]
    CH --> SAFE
    PW --> SAFE
  end

  JOB --> CH
  JOB --> PW
  CH --> R1
  CH --> R2
  CH --> R3
  PW --> R4
  SAFE --> RAW

  FE -->|HTTPS| API
  API -->|SQL reads| FINAL
  FINAL --> API
  API --> FE
```

## Request path (runtime)

```mermaid
sequenceDiagram
  autonumber
  participant User as "User (Browser)"
  participant FE as "Frontend (Vite + React)"
  participant API as "Express API (TypeScript)"
  participant DB as "PostgreSQL (read-optimised tables)"

  User->>FE: Browse category / search / open product page
  FE->>API: GET /protein | /creatine | /suggest | /products/:slug
  API->>DB: SELECT from read-optimised tables (ranked + history summaries)
  DB-->>API: Rows (ranked lists / offers / history + lows)
  API-->>FE: JSON response
  FE-->>User: Render tables + offers + price history
```

## Ingestion path (daily pipeline)

```mermaid
sequenceDiagram
  autonumber
  participant Cron as "Cron (daily ~03:00 NZT)"
  participant Job as "db:reset-and-scrape (orchestrator)"
  participant Scrape as "Scrapers (Cheerio / Playwright)"
  participant Raw as "PostgreSQL (public.scraped_products)"
  participant SQL as "SQL normalise + build steps"
  participant Final as "PostgreSQL (read tables)"
  participant Log as "logs/db-reset-and-scrape.log"

  Cron->>Job: Start scheduled run
  Job->>Log: Append start + progress
  Job->>Scrape: Fetch + parse retailer listings (best-effort per retailer)
  Scrape-->>Job: Structured rows (product snapshots)
  Job->>Raw: Insert raw listing snapshots
  Job->>SQL: Run normalisation + unification + category builds
  SQL->>Final: Write/update read-optimised tables + price history + lows
  Job->>Log: Append completion (or error, continue where possible)
```
