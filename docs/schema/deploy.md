## Deployment: how SupplementSmarter runs in production

SupplementSmarter is operated as a small production service with a scheduled ingestion pipeline and a read-focused API

The key operational goals are:

- Predictable reads (API stays fast and bounded)
- Reproducible ingestion (scrape, normalise, build)

---

## Runtime architecture

- **Host:** AWS EC2 (Ubuntu)
- **Process manager:** PM2
- **API:** Node.js + Express (TypeScript via `tsx`)
- **Database:** PostgreSQL running locally on the same EC2 machine
- **Ingestion:** cron-triggered daily job that runs the scrape + rebuild pipeline

---

## Deployment (server)

Deployment is intentionally simple and repeatable.

Typical flow on the EC2 host:

1. SSH into the instance
2. Pull the latest code (server branch)
3. Install dependencies with a clean install
4. Restart the API process via PM2

---

## Scheduled ingestion (cron)

Scraping + rebuild is triggered by a daily cron job intended to run at ~3am NZT.

Cron entry:

```cron
0 3 * * * cd /home/ubuntu/SupplementSmarter/server && /usr/bin/npm run db:reset-and-scrape >> /home/ubuntu/SupplementSmarter/logs/db-reset-and-scrape.log 2>&1
```

What this does:

- Changes into the server directory
- Runs the ingestion pipeline
- Appends stdout/stderr to a persistent log file on disk
