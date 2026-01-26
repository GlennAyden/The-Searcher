# Integration Test Plan: System Integrity Verification

**Date:** 2026-01-26
**Scope:** Verification of Backend (Python/FastAPI) and Frontend (Next.js) integration after recent refactoring.

## 1. Environment & Prerequisites
Before running tests, ensure the environment is correctly set up.
- [ ] **Python Virtual Environment**: Active and dependencies installed.
  - Check: `python -m pip freeze` reports installed packages.
- [ ] **Node.js Environment**: Modules installed.
  - Check: `frontend/node_modules` exists.
- [ ] **Configuration**: `.env` file exists in `backend/` and `frontend/` (if applicable).

## 2. Backend Verification
**Goal:** Ensure API is serving requests and data pipelines are intact.

### 2.1 Static & Environment Checks
Run these commands from `backend/`:
```powershell
cd backend
# Verify environment variables
python scripts/check_env.py
```

### 2.2 Unit & Integration Tests
Run available pytest suites to catch regressions in core logic.
```powershell
cd backend
# Run all tests
pytest tests/
```

### 2.3 Server Startup Check
Verify the FastAPI server starts without errors.
```powershell
cd backend
python main.py
# Expect: Uvicorn running on http://0.0.0.0:8000
```
*Manual Verification:* Open `http://localhost:8000/docs` in browser.

## 3. Frontend Verification
**Goal:** Ensure the Next.js application builds, lints, and routes correctly.

### 3.1 Static Analysis (Linting)
Catch broken imports or type errors from moved files.
```powershell
cd frontend
npm run lint
```

### 3.2 Build Verification
Ensure a production build succeeds (stricter than dev mode).
```powershell
cd frontend
npm run build
```

## 4. End-to-End (E2E) Critical Flow Checklist
**Goal:** Verify user flows in the running application.
**Setup:** Ensure Backend is running on port 8000 and Frontend on port 3000.

### 4.1 Navigation & Layout
- [ ] **Sidebar**: Verify all links (Dashboard, News, Alpha Hunter, etc.) operate and navigate to correct routes.
- [ ] **Routing**: Verify no 404s on main feature pages.

### 4.2 Feature: Alpha Hunter (Heavy Refactor Target)
- [ ] **Load**: Go to `/alpha-hunter`. Verify "Stage 1" loads.
- [ ] **Interactivity**: Click a ticker (e.g., "BREN", "DEWA"). Verify data updates (VPA, Flow, Supply cards).
- [ ] **Stages**: Switch between Stage 1, 2, 3, 4 tabs/views if applicable.

### 4.3 Feature: Dashboard
- [ ] **Metrics**: Verify "Market Sentiment" and "Ticker Cloud" rendering.
- [ ] **Data**: Ensure no "Network Error" on load.

### 4.4 Feature: News Library
- [ ] **Feed**: Verify news items appear.
- [ ] **Filter**: Test "Sentiment" or "Search" filters to ensure API params are passed correctly.

## 5. Full Feature Test Matrix (Per Feature, Multiple Scenarios)
**Goal:** Cover all website features with happy path, edge cases, and error states.
**Note:** Avoid destructive scripts (no DB wipes). Use read-only checks or normal UI actions.

### 5.1 Dashboard (/dashboard)
- [ ] **Happy path**: Page loads with summary cards, charts, and ticker cloud.
- [ ] **Empty data**: If `news` table empty, UI shows empty or zero states without crash.
- [ ] **API error**: Simulate backend down; UI shows error state, no infinite spinners.
- [ ] **Filters/tickers**: Selecting ticker or timeframe updates charts and calls correct endpoints.
- [ ] **Data freshness**: Reload page; ensure cached UI does not show stale values after refresh.

### 5.2 News Library (/news-library)
- [ ] **Happy path**: News list renders with sentiment badges and summaries.
- [ ] **Filter by ticker**: Enter a valid ticker; list updates.
- [ ] **Filter by sentiment/source/date**: Each filter applies correct query params.
- [ ] **Search edge cases**: Empty query, short query, special characters.
- [ ] **Pagination**: Next/prev or infinite scroll works without duplicates.
- [ ] **Missing summary**: News without AI summary still renders safely.

### 5.3 IDX Disclosures + RAG Chat (/rag-chat)
- [ ] **Disclosure list**: Data loads with correct metadata and status.
- [ ] **Sync disclosures**: Trigger sync; backend returns status, list updates.
- [ ] **Open file**: Open a disclosure file; handles missing file gracefully.
- [ ] **RAG chat**: Ask a simple question; response returns and sources reference a disclosure.
- [ ] **No data**: If no disclosures exist, UI shows empty state.

### 5.4 NeoBDM Summary (/neobdm-summary)
- [ ] **Happy path**: Daily and cumulative summaries load.
- [ ] **Method toggle**: MM/NR/Foreign switches render new data.
- [ ] **Period toggle**: Daily vs cumulative data loads correctly.
- [ ] **Scrape flag**: Trigger scrape for a date; new data appears.
- [ ] **Empty data**: No records in DB shows empty state, not error.

### 5.5 NeoBDM Tracker (/neobdm-tracker)
- [ ] **Happy path**: History chart loads for a valid ticker.
- [ ] **Ticker validation**: Invalid ticker shows error, no crash.
- [ ] **Method/period switch**: Updates chart and table.
- [ ] **Short history**: Less than expected days still renders.
- [ ] **Data mismatch**: Missing columns handled without UI error.

### 5.6 Broker Summary (/broker-summary)
- [ ] **Happy path**: Buy/sell tables load for ticker/date.
- [ ] **Available dates**: Date chips show; selecting date refreshes data.
- [ ] **Top holders**: Top holders section shows correct values.
- [ ] **Floor price**: Floor price analysis returns confidence and values.
- [ ] **Broker journey**: Select brokers and date range; chart and stats render.
- [ ] **No data**: Empty broker summary shows informative empty states.
- [ ] **Batch scrape**: Start batch scrape; UI shows processing and later data appears.
- [ ] **Broker 5 percent**: CRUD add/update/delete broker; list updates immediately.

### 5.7 Price & Volume (/price-volume)
- [ ] **Happy path**: OHLCV chart and volume render.
- [ ] **Spike markers**: Marker overlay appears when data exists.
- [ ] **Compression**: Compression endpoint returns result; UI reflects status.
- [ ] **Flow impact**: Market cap based impact renders.
- [ ] **Anomaly scan**: Scan endpoint returns list; UI shows results.
- [ ] **No data**: Missing price volume records show empty state without crash.

### 5.8 Alpha Hunter (/alpha-hunter)
- [ ] **Stage 1 scan**: Candidate list loads with scores and badges.
- [ ] **Stage 2 VPA**: Selecting ticker shows VPA cards and charts.
- [ ] **Stage 3 flow**: Smart vs retail flow summary loads (uses broker summary).
- [ ] **Stage 4 supply**: Supply analysis renders, handles no Done Detail data.
- [ ] **Watchlist CRUD**: Add/remove ticker; persistence works.
- [ ] **Stage updates**: Update stage via UI; backend reflects change.

### 5.9 Done Detail (/done-detail)
- [ ] **Paste flow**: Paste TSV data and save; synthesis runs and confirms.
- [ ] **Exists check**: `/exists` returns true after save.
- [ ] **Data view**: Raw records table renders.
- [ ] **Sankey/inventory**: Charts render for saved date.
- [ ] **Imposter/speed/combined**: Analysis returns from synthesis for single date.
- [ ] **Range analysis**: Range query handles no synthesis gracefully.
- [ ] **Delete**: Delete a date; records and synthesis removed, UI updates.

### 5.10 Broker Stalker (/broker-stalker)
- [ ] **Prototype UI**: Page loads without API calls.
- [ ] **Static data**: Placeholders render; no console errors.

### 5.11 Scraper Engine (backend)
- [ ] **/api/scrape**: Endpoint responds with task status.
- [ ] **NeoBDM batch**: `/api/neobdm-batch-scrape` starts background job.
- [ ] **Failure handling**: Wrong credentials returns clear error message.
- [ ] **No DB deletion**: Ensure no script wipes data during scrape flow.

## 6. Automated Verification Script
A script `verify_integration.ps1` will be created to automate Steps 2.1, 2.2, 3.1, and 3.2.

```powershell
# Usage
./verify_integration.ps1
```
