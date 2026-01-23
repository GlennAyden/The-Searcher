# Market Intelligence System

## Overview
Market Intelligence System is a full-stack toolkit for Indonesian equities analysis. It combines news sentiment, NeoBDM fund flow data, broker summaries, price-volume analytics, and workflow-driven screening (Alpha Hunter).

Core capabilities:
- News aggregation with sentiment labeling and summaries.
- NeoBDM flow analysis (summary, history, hot signals, broker summaries).
- Price and volume analytics with anomaly scoring.
- Alpha Hunter multi-stage screening workflow.
- Done Detail analysis from pasted trade data.
- Forecasting and backtest endpoints for price series.
- Scraper orchestration for data backfill.

Tech stack:
- Backend: FastAPI + SQLite
- Frontend: Next.js

## System Map
```
Next.js UI
  -> services/api/*
  -> FastAPI routes (/api/*)
      -> modules/* (business logic)
      -> db/* repositories
          -> SQLite (backend/data/market_sentinel.db)

Scrapers
  -> modules/scraper_* (CNBC, EmitenNews, IDX)
  -> db repositories (news, disclosures, NeoBDM)
```

## Feature Catalog (Detailed)

### 1) Dashboard
UI route: `/dashboard`
Purpose: High-level market stats and sentiment correlation.
Data sources: `news` table and market data pulled via `data_provider` (yfinance).
Key endpoints:
- `GET /api/dashboard-stats`
- `GET /api/market-data`
- `GET /api/sentiment-data`
- `GET /api/tickers`
- `GET /api/issuer-tickers`

What you see:
- Summary cards for market and sentiment status.
- Correlation charts for price vs sentiment.
- Ticker lists for quick navigation.

### 2) News Library
UI route: `/news-library`
Purpose: Browse and filter news with sentiment labels and AI summaries.
Data sources: Scrapers (CNBC, EmitenNews, IDX) + sentiment model output stored in `news` table.
Key endpoints:
- `GET /api/news`
- `GET /api/brief-news`
- `GET /api/brief-single`
- `GET /api/ticker-counts`
- `GET /api/wordcloud`

What you see:
- News list with filters by ticker, date, source, and sentiment.
- Short AI summaries to speed scanning.
- Ticker counts and word cloud for trend discovery.

### 3) IDX Disclosures + RAG Chat
UI route: `/rag-chat`
Purpose: Browse IDX disclosures and ask questions over documents.
Data sources: `idx_disclosures` table and local PDFs in `backend/downloads`.
Key endpoints:
- `GET /api/disclosures`
- `POST /api/chat`
- `POST /api/sync-disclosures`
- `POST /api/open-file`

What you see:
- Disclosure listing with metadata and status.
- RAG chat that answers from local disclosure documents.

### 4) NeoBDM Summary
UI route: `/neobdm-summary`
Purpose: Snapshot view of market maker, non-retail, and foreign fund flow.
Data sources: `neobdm_records` and `neobdm_summaries` tables.
Key endpoints:
- `GET /api/neobdm-summary`
- `GET /api/neobdm-dates`
- `GET /api/neobdm-hot`
- `GET /api/neobdm-tickers`

What you see:
- Daily and cumulative flow by method (MM/NR/Foreign).
- Flags such as pinky/crossing/unusual.
- Hot signal list generated from scoring engine.

### 5) NeoBDM Tracker (Flow Tracker)
UI route: `/neobdm-tracker`
Purpose: Historical flow visualization and time-series inspection.
Data sources: `neobdm_records` history.
Key endpoints:
- `GET /api/neobdm-history` (also `/api/neobdm/history` alias)

What you see:
- Multi-timeframe flow charts and trend context.
- Quick switching between tickers/methods/periods.

### 6) Broker Summary
UI route: `/broker-summary`
Purpose: Deep dive into broker activity and accumulation patterns.
Data sources: `neobdm_broker_summaries` and `broker_five_percent`.
Key endpoints:
- `GET /api/neobdm-broker-summary`
- `GET /api/neobdm-broker-summary/available-dates/{ticker}`
- `POST /api/neobdm-broker-summary/journey`
- `GET /api/neobdm-broker-summary/top-holders/{ticker}`
- `GET /api/neobdm-broker-summary/floor-price/{ticker}`
- `POST /api/neobdm-broker-summary-batch`
- `GET /api/broker-summary`
- `GET/POST/PUT/DELETE /api/broker-five` (broker watchlist CRUD)

What you see:
- Net buy/sell per broker per date.
- Broker journey charts (accumulation/distribution timeline).
- Top holders and floor price analysis.
- Manual broker watchlist for each ticker.

### 7) Price and Volume
UI route: `/price-volume`
Purpose: Price-volume charting, anomaly detection, and screening inputs.
Data sources: `price_volume`, `market_metadata`, and `market_cap_history` tables. Data is ingested from yfinance.
Key endpoints:
- `GET /api/price-volume/{ticker}`
- `GET /api/price-volume/{ticker}/spike-markers`
- `GET /api/price-volume/{ticker}/compression`
- `GET /api/price-volume/{ticker}/flow-impact`
- `GET /api/price-volume/{ticker}/exists`
- `GET /api/price-volume/{ticker}/market-cap`
- `GET /api/price-volume/unusual/scan`
- `GET /api/price-volume/anomaly/scan`
- `POST /api/price-volume/refresh-all`

What you see:
- OHLCV chart with spike markers and volume overlays.
- Sideways compression detection for pre-breakout setups.
- Flow impact scoring (value traded vs market cap).
- Market-wide anomaly scans.

### 8) Alpha Hunter Lab
UI route: `/alpha-hunter`
Purpose: Multi-stage screening workflow with watchlist-driven investigation.
Data sources: `neobdm_records`, `price_volume`, `alpha_hunter_watchlist`, `alpha_hunter_tracking`, and Done Detail data.
Key endpoints:
- `GET /api/alpha-hunter/stage1/scan` (flow-based candidate scan)
- `GET /api/alpha-hunter/stage2/vpa/{ticker}` (volume-price analysis)
- `GET /api/alpha-hunter/flow/{ticker}` (stage 3 smart flow)
- `GET /api/alpha-hunter/supply/{ticker}` (stage 4 supply analysis)
- `GET/POST /api/alpha-hunter/watchlist`
- `POST /api/alpha-hunter/stage` (stage update)
- `POST /api/alpha-hunter/parse-done-detail`

Stages overview:
- Stage 1: NeoBDM flow-based signal scan and candidate selection.
- Stage 2: VPA validation using price-volume engine (spike, compression, pullback health).
- Stage 3: Smart money flow checks from broker summary + floor price context.
- Stage 4: Supply analysis using Done Detail data.

### 9) Done Detail
UI route: `/done-detail`
Purpose: Paste-based trade analysis for broker behavior and transaction dynamics.
Data sources: `done_detail_records` and `done_detail_synthesis`.
Key endpoints:
- `POST /api/done-detail/save`
- `GET /api/done-detail/exists/{ticker}/{trade_date}`
- `GET /api/done-detail/data/{ticker}/{trade_date}`
- `GET /api/done-detail/history`
- `DELETE /api/done-detail/{ticker}/{trade_date}`
- `GET /api/done-detail/sankey/{ticker}/{trade_date}`
- `GET /api/done-detail/inventory/{ticker}/{trade_date}`
- `GET /api/done-detail/analysis/{ticker}/{trade_date}`
- `GET /api/done-detail/imposter/{ticker}`
- `GET /api/done-detail/speed/{ticker}`
- `GET /api/done-detail/combined/{ticker}`
- `GET /api/done-detail/broker/{ticker}/{broker_code}`
- `GET /api/done-detail/range-analysis/{ticker}`
- `GET /api/done-detail/status`

What you see:
- Broker flow charts, speed analysis, and imposter detection.
- Sankey and inventory views for buy/sell distribution.
- Cached synthesis for fast range analysis.

### 10) Forecasting
UI route: `/forecasting`
Purpose: Price forecasting plus backtest and insight endpoints.
Data sources: yfinance and `market_analytics_cache`.
Key endpoints:
- `GET /api/forecast/{symbol}`
- `GET /api/forecast/{symbol}/backtest`
- `GET /api/forecast/{symbol}/insight`

What you see:
- Forecast chart with trend projection.
- Backtest results for recent periods.
- Automated narrative insights.

### 11) Broker Stalker
UI route: `/broker-stalker`
Purpose: Visual concept for broker surveillance.
Status: UI prototype with static data (no backend wiring yet).

### 12) Scraper Engine
Backend-only feature for data ingestion and backfill.
Key endpoint:
- `POST /api/scrape`

Notes:
- Scrapers are in `backend/modules/scraper_*` (CNBC, EmitenNews, IDX).
- NeoBDM batch scraping available via `POST /api/neobdm-batch-scrape`.

## Data Storage
SQLite database lives at `backend/data/market_sentinel.db`.
Core tables include:
- `news`
- `idx_disclosures`
- `neobdm_records`, `neobdm_summaries`, `neobdm_broker_summaries`
- `broker_five_percent`
- `price_volume`, `market_metadata`, `market_cap_history`
- `alpha_hunter_watchlist`, `alpha_hunter_tracking`
- `done_detail_records`, `done_detail_synthesis`

## API Docs
Once the backend is running:
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development
Backend:
- `python backend/test_routers.py`
- `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`

Frontend:
- `npm --prefix frontend run dev`
- `npm --prefix frontend run build`

## License
Proprietary - Market Intelligence System
