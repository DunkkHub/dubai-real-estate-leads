# Dubai Real Estate Opportunity Scraper

Scraper-first, consent-safe Dubai real estate opportunity discovery and CRM platform.

## What It Does

- Stores public social conversations as `Opportunity` records, not leads.
- Creates CRM `Lead` records only after explicit consent through the landing page, ROI calculator, manual proof, CSV proof, or Meta Lead Ads metadata.
- Stores consent proof: exact text, timestamp, source, channel, IP, user agent, and allowed contact channels.
- Provides dashboard KPIs, source/lead-stage charts, outreach queue, CRM pipeline, notes, follow-ups, import/export, deletion, withdrawal, and compliance settings.
- Includes official-API connector modules for Reddit, YouTube, X, Meta webhooks, CSV import, and a robots-aware Public Web scraper.
- Does not include automatic DMs, automatic comments, profile contact scraping, or spam sending.
- Adds a dedicated `/scraper` dashboard for scrape jobs, hot/warm/ignored public opportunities, source quality, and opportunity CSV export.

## Tech Stack

Next.js `16.2.9` App Router, TypeScript, Tailwind CSS, shadcn-style local UI components, PostgreSQL, Prisma `7.8`, NextAuth credentials login, Zod, React Hook Form, Recharts, Docker Compose, Vitest.

## Setup

```bash
pnpm install
docker compose up -d
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Seeded login:

- Email: `admin@dubai-leads.local`
- Password: `Password123!`

## Environment

Copy `.env.example` to `.env` and update secrets before production.

Required:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `APP_URL`

Optional:

- `OPENAI_API_KEY`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `YOUTUBE_API_KEY`
- `X_BEARER_TOKEN`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`

Missing source credentials are shown as `not_configured` and do not crash pages.

## Scraper Commands

The scraper commands create `ScrapeJob` records and save only public, buyer-intent `Opportunity` records. Missing API keys return a clean `not_configured` result.

```bash
pnpm scrape:reddit
pnpm scrape:youtube
pnpm scrape:x
pnpm scrape:web
pnpm scrape:all
```

Source behavior:

- Reddit uses the official OAuth API, searches targeted public subreddits, then stores matching posts and comments separately.
- YouTube uses the YouTube Data API, searches Dubai real estate videos, then stores qualifying public top-level comments from `commentThreads.list`.
- X uses the official recent search API when `X_BEARER_TOKEN` is available.
- Public Web fetches only configured public URLs, checks `robots.txt`, supports CSS selectors, pagination templates, delays, timeouts, and text-hash dedupe.

The scorer classifies opportunities as `HOT`, `WARM`, `LOW`, or `IGNORE` using buyer/investor phrases, budget, timeline, mortgage/ROI/off-plan language, Dubai areas, and spam/irrelevance penalties.

## Public Web Scraper

The `/sources` page includes `Public Web`, a scraper for operator-approved seed URLs.

It:

- fetches public HTTP/HTTPS pages only
- checks `robots.txt` before fetching each page
- uses a clear `DubaiLeadCRM-WebScraper` user agent
- scans public page text for configured Dubai real estate intent keywords
- saves matching snippets as `Opportunity` records
- supports CSS selector extraction, pagination templates, maximum pages, request delay, request timeout, and text hash duplicate detection
- never stores scraped emails, phones, WhatsApp numbers, or private profile contact data

It does not:

- log into websites
- bypass paywalls, CAPTCHAs, robots.txt, or rate limits
- scrape private contact details
- create CRM leads without consent

## CSV Imports

Opportunity CSV accepts:

- `sourceUrl`
- `platform`
- `publicTextSnippet` or `text`
- optional `title`, `externalId`, `postId`, `commentId`, `authorHandle`, `language`

Opportunity export is available at `/api/opportunities/export` and includes:

- `platform`
- `sourceUrl`
- `title`
- `publicTextSnippet`
- `authorHandle`
- `detectedBudget`
- `detectedArea`
- `detectedTimeline`
- `detectedPropertyType`
- `intentCategory`
- `intentScore`
- `status`
- `scrapedAt`

Lead CSV requires consent proof:

- `fullName`
- at least one of `email`, `phone`, `whatsapp`
- `consentTimestamp` or `consentDate`
- `consentSourceUrl` or `consentSource`
- recommended: `consentText`, `consentChannel`, `budgetAed`, `transactionType`, `propertyType`, `preferredArea`, `purpose`, `timeline`

Lead rows without consent source/date are rejected.

## Tests

```bash
pnpm test
pnpm lint
pnpm build
```

## Compliance Notes

- Public conversations are opportunities only.
- Leads require a `ConsentRecord`.
- Consent checkbox is unchecked by default.
- Marketing contact should check `consentStatus` and channel flags first.
- Users can withdraw consent at `/unsubscribe/[leadId]`.
- Agents can export or delete a lead from `/leads/[id]`.
- Imports, exports, lead creation, consent changes, and deletion are audit logged.
- Source connectors never collect private contact data and expose no automatic reply/DM behavior.
