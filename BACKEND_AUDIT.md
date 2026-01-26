# Backend Audit and Refactor Plan

## 📊 Progress Summary (Updated: 2026-01-26)

| Phase | Status | Key Impact |
|-------|--------|------------|
| Phase 1: Quick Fixes | ✅ COMPLETED | Config centralized, utils moved |
| Phase 2: Service Layer | ✅ COMPLETED | 4 feature modules created |
| Phase 3: Route Slimming | ✅ COMPLETED | **1323 lines removed (62%)** |
| Phase 4: Scraper Consolidation | ⏳ TODO | |
| Phase 5: Type Safety & Schemas | ⏳ TODO | |
| Phase 6: Testing Infrastructure | ⏳ TODO | |

### Files Changed in Phase 2-3
```
features/
├── done_detail/       # 2122→350 lines, service + 4 analysis
├── neobdm/            # 1965→300 lines, service + 3 analysis
├── price_volume/      # HK analyzer + service
└── alpha_hunter/      # Service wrapper
routes/
├── neobdm.py          # 714→304 lines (57% reduction)
├── price_volume.py    # 997→280 lines (72% reduction)
└── alpha_hunter.py    # 426→230 lines (46% reduction)
```

---

## Overview
Comprehensive audit of the FastAPI backend (`backend/`) to identify technical debt, code smells, and create a modular refactoring plan that aligns with the frontend's "Feature First" architecture from `FRONTEND_AUDIT.md`.

---

## Current Architecture Snapshot

### Entry Point
- **Main App**: `backend/main.py` (139 lines)
  - FastAPI app with 10 registered routers
  - CORS + GZip middleware
  - Startup event for DB sync and cleanup
  - ⚠️ **Issue**: Duplicate import `done_detail_router` on lines 47-48 and 129-130

### Layer Structure
```
backend/
├── main.py              # FastAPI app entry
├── config.py            # Paths and settings
├── data_provider.py     # Legacy data provider
├── rag_client.py        # RAG chat client
├── routes/              # API endpoint handlers
│   ├── __init__.py
│   ├── alpha_hunter.py        (426 lines, 13 endpoints)
│   ├── broker_five.py         (2850 bytes)
│   ├── dashboard.py           (5134 bytes)
│   ├── disclosures.py         (5418 bytes)
│   ├── done_detail.py         (469 lines, 19 endpoints)
│   ├── neobdm.py              (714 lines, 19 endpoints) ⚠️
│   ├── news.py                (17215 bytes)
│   ├── price_volume.py        (997 lines, 13 endpoints) ⚠️
│   └── scrapers.py            (5931 bytes)
├── modules/             # Core business logic & scrapers
│   ├── alpha_hunter_*.py      (5 files, ~100KB total)
│   ├── scraper_*.py           (5 scrapers)
│   ├── analyzer.py
│   ├── broker_utils.py
│   ├── database.py
│   ├── market_data.py
│   ├── sync_utils.py
│   ├── technical_analyst.py
│   ├── ticker_utils.py
│   ├── utils.py
│   └── volume_fetcher.py
├── db/                  # Repository pattern
│   ├── connection.py          (BaseRepository, DatabaseConnection)
│   ├── alpha_hunter_repository.py
│   ├── broker_five_repository.py
│   ├── disclosure_repository.py
│   ├── done_detail_repository.py   (2122 lines) ⚠️⚠️
│   ├── market_metadata_repository.py
│   ├── neobdm_repository.py        (1965 lines) ⚠️⚠️
│   ├── news_repository.py
│   └── price_volume_repository.py  (29KB)
├── services/            # ⚠️ EMPTY - should contain service layer
├── utils/               # ⚠️ EMPTY - should contain shared utilities
├── scripts/             # CLI tools & batch jobs
├── tests/               # Test files
└── data/                # JSON data files (tickers, etc.)
```

---

## Major Code Smells & Technical Debt

### 1. Monolithic Repositories ~~(CRITICAL)~~ ✅ FIXED
| File | Before | After | Status |
|------|--------|-------|--------|
| `done_detail_repository.py` | 2122 | 350 | ✅ Split to `features/done_detail/` |
| `neobdm_repository.py` | 1965 | 300 | ✅ Split to `features/neobdm/` |
| `alpha_hunter_vpa.py` | 1527 | 1527 | ⏳ Wrapped by service |
| `scraper_neobdm.py` | 982 | 982 | ⏳ Phase 4 target |

### 2. Fat Route Files ~~(HIGH)~~ ✅ FIXED
Route files now delegate to service layer:
- ~~`routes/price_volume.py` (997 lines)~~ → **280 lines** ✅
- ~~`routes/neobdm.py` (714 lines)~~ → **304 lines** ✅
- ~~`routes/alpha_hunter.py` (426 lines)~~ → **230 lines** ✅

### 3. Empty Service/Utils Layers ~~(HIGH)~~ ✅ FIXED
- `features/` now contains 4 feature modules with service layers
- `shared/utils/` contains `technical.py`, `common.py`, etc.

### 4. Scattered Configuration (MEDIUM)
- `config.py` - basic paths only
- Hardcoded URLs in scrapers
- `.env` for secrets but not centralized

### 5. Duplicate/Inconsistent Patterns (MEDIUM)
- `main.py` has duplicate `done_detail_router` import
- `routes/__init__.py` missing `done_detail_router`, `price_volume_router`, `alpha_hunter_router`
- Mixed instantiation patterns (singleton vs per-request)

### 6. Missing Type Hints (LOW-MEDIUM)
- Many functions lack return type hints
- Some Pydantic models incomplete

---

## Route-to-Feature Mapping (Aligned with Frontend)

| Frontend Feature | Route File | Repository | Modules |
|------------------|------------|------------|---------|
| Dashboard | `dashboard.py` | `news_repository.py` | `database.py`, `data_provider.py` |
| News Library | `news.py` | `news_repository.py` | `scraper*.py`, `analyzer.py` |
| Story Finder | (in `news.py`) | `news_repository.py` | `scraper*.py` |
| RAG Chat | `disclosures.py` | `disclosure_repository.py` | `rag_client.py` |
| NeoBDM Summary | `neobdm.py` | `neobdm_repository.py` | `scraper_neobdm.py` |
| NeoBDM Tracker | `neobdm.py` | `neobdm_repository.py` | `scraper_neobdm.py` |
| Broker Summary | `neobdm.py`, `broker_five.py` | `neobdm_repository.py`, `broker_five_repository.py` | `scraper_neobdm.py` |
| Price Volume | `price_volume.py` | `price_volume_repository.py`, `market_metadata_repository.py` | `market_data.py`, `volume_fetcher.py` |
| Alpha Hunter | `alpha_hunter.py` | `alpha_hunter_repository.py`, `neobdm_repository.py`, `price_volume_repository.py` | `alpha_hunter_*.py` (5 files) |
| Done Detail | `done_detail.py` | `done_detail_repository.py` | - |
| Scrapers Control | `scrapers.py` | - | `scraper.py`, `sync_utils.py` |

---

## Target Modularization Layout

```
backend/
├── main.py                    # Thin entry point only
├── config/
│   ├── __init__.py
│   ├── settings.py            # All configs centralized
│   └── constants.py           # App-wide constants
├── core/
│   ├── __init__.py
│   ├── database.py            # DB connection singleton
│   └── exceptions.py          # Custom exceptions
├── features/
│   ├── dashboard/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── news/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   ├── neobdm/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── scraper.py
│   │   ├── broker_summary/
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   └── schemas.py
│   ├── price_volume/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   ├── alpha_hunter/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── stages/
│   │   │   ├── stage1_scanner.py
│   │   │   ├── stage2_vpa.py
│   │   │   ├── stage3_flow.py
│   │   │   └── stage4_supply.py
│   │   └── schemas.py
│   ├── done_detail/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── analysis/
│   │   │   ├── imposter.py
│   │   │   ├── speed.py
│   │   │   └── range.py
│   │   └── schemas.py
│   ├── disclosures/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── rag_client.py
│   └── scrapers/
│       ├── router.py
│       ├── base_scraper.py
│       ├── bisnis_scraper.py
│       ├── cnbc_scraper.py
│       ├── idx_scraper.py
│       └── investor_scraper.py
├── shared/
│   ├── __init__.py
│   ├── utils/
│   │   ├── broker_utils.py
│   │   ├── ticker_utils.py
│   │   └── string_utils.py
│   ├── types/
│   │   └── market.py
│   └── middleware/
│       └── logging.py
└── scripts/                   # Keep as-is for CLI tools
```

---

## Refactoring Checklist

### Phase 1: Quick Fixes (Low Risk) ✅ COMPLETED
- [x] Fix duplicate `done_detail_router` import in `main.py`
- [x] Update `routes/__init__.py` to export all routers
- [x] Move `modules/utils.py` → `shared/utils/common.py`
- [x] Move `modules/broker_utils.py` → `shared/utils/broker_utils.py`
- [x] Move `modules/ticker_utils.py` → `shared/utils/ticker_utils.py`
- [x] Create `config/settings.py` and consolidate config
- [x] Legacy modules re-export from new locations (backward compatible)

### Phase 2: Service Layer Introduction (Medium Risk)
- [ ] Create `services/` directory with feature subdirs
- [ ] **Dashboard**:
  - [ ] Extract logic from `routes/dashboard.py` → `features/dashboard/service.py`
- [ ] **News**:
  - [ ] Extract from `routes/news.py` → `features/news/service.py`
  - [ ] Keep `NewsRepository` but simplify
- [x] **NeoBDM**: ✅ COMPLETED
  - [x] Split `neobdm_repository.py` (1965 → 300 lines):
    - [x] CRUD operations → `features/neobdm/repository.py`
    - [x] Broker summary → `features/neobdm/analysis/broker_summary.py`
    - [x] Floor price → `features/neobdm/analysis/floor_price.py`
    - [x] Hot signals → `features/neobdm/analysis/signals.py`
  - [x] Created service layer → `features/neobdm/service.py`
- [x] **Price Volume**: ✅ COMPLETED
  - [x] HK Analysis → `features/price_volume/hk_analyzer.py` (234 lines)
  - [x] MA calculations → `shared/utils/technical.py`
  - [x] Created service layer → `features/price_volume/service.py`
- [x] **Done Detail**: ✅ COMPLETED
  - [x] Split `done_detail_repository.py` (2122 → 350 lines):
    - [x] CRUD operations → `features/done_detail/repository.py`
    - [x] Imposter analysis → `features/done_detail/analysis/imposter.py`
    - [x] Speed analysis → `features/done_detail/analysis/speed.py`
    - [x] Combined/Range → `features/done_detail/analysis/combined.py`
    - [x] Visualization → `features/done_detail/analysis/visualization.py`
  - [x] Created service layer → `features/done_detail/service.py`
  - [x] Legacy repo delegates to new modules (backward compatible)
- [x] **Alpha Hunter**: ✅ COMPLETED
  - [x] Created service layer → `features/alpha_hunter/service.py`
  - [x] Wraps existing modules: `modules/alpha_hunter_*.py` (VPA, Flow, Supply, Scorer)
  - [x] Clean interface for routes to use

### Phase 3: Route Slimming ✅ COMPLETED
- [x] `routes/neobdm.py` (714→304 lines): ✅ DONE
  - [x] Uses NeoBDMService for business logic
  - [x] Centralized imports
  - [x] Extracted sync logic to service
- [x] `routes/price_volume.py` (997→280 lines): ✅ DONE
  - [x] Uses PriceVolumeService for business logic
  - [x] HK analysis uses features/price_volume/hk_analyzer.py
  - [x] MA calculations use shared/utils/technical.py
- [x] `routes/alpha_hunter.py` (426→230 lines): ✅ DONE
  - [x] Uses AlphaHunterService for business logic
  - [x] Consolidated filtering logic in stage1_flow_scanner

### Phase 4: Scraper Consolidation ✅ MOSTLY COMPLETE
- [x] Create `features/scrapers/base.py` with common logic ✅
  - [x] Session management with proper headers
  - [x] Retry logic with exponential backoff
  - [x] Rate limiting
  - [x] Parallel processing utility
  - [x] Indonesian date parsing
- [x] Migrate scrapers to inherit from BaseScraper:
  - [x] `scraper_investor.py`: 464→280 lines (40% reduction) ✅
  - [x] `scraper_bisnis.py`: 560→300 lines (46% reduction) ✅
  - [ ] `scraper_cnbc.py`: TODO (same pattern)
  - [ ] `scraper_idx.py`: TODO (same pattern)
- [ ] Move hardcoded URLs to config (optional)

### Phase 5: Type Safety & Schemas ✅ COMPLETED
- [x] Create shared types in `shared/types/`:
  - [x] `market.py`: OHLCVRecord, BrokerSummaryRecord, FlowData, HotSignal, etc.
  - [x] `responses.py`: APIResponse, PaginatedResponse, ErrorResponse, feature responses
- [ ] Add return type hints to all service methods (gradual adoption)
- [ ] Use schemas in routes (gradual adoption)

### Phase 6: Testing Infrastructure (Medium Risk)
- [ ] Organize tests to mirror `features/` structure
- [ ] Add fixture factories for test data
- [ ] Add integration tests for critical paths

---

## Immediate Actions (Priority Order)

1. ~~**[BUG]** Fix duplicate router import in `main.py`~~ ✅ DONE
2. ~~**[DEBT]** Split `done_detail_repository.py`~~ ✅ DONE → `features/done_detail/`
3. ~~**[DEBT]** Split `neobdm_repository.py`~~ ✅ DONE → `features/neobdm/`
4. ~~**[ARCH]** Create service layer for `price_volume`~~ ✅ DONE → `features/price_volume/`
5. ~~**[ARCH]** Consolidate configuration~~ ✅ DONE → `config/settings.py`

### Next Priority:
6. **[ARCH]** Phase 4: Scraper consolidation - create base scraper class
7. **[QUALITY]** Phase 5: Add Pydantic schemas for type safety

---

## Files to Delete (Dead Code Candidates)
Based on import analysis, the following files may be unused:
- [ ] Verify `data_provider.py` usage - may be legacy (Dashboard migrated?)
- [ ] Verify `idx_processor.py` in root - duplicate exists in `scripts/`

---

## Open Questions
1. Should `scraper_neobdm.py` be async-first or sync with async wrappers?
2. Is `rag_client.py` at root level used? Should it move to `features/disclosures/`?
3. Should we keep SQLite or consider migration to PostgreSQL for production?
4. How to handle background tasks - keep in routes or create dedicated workers?

---

## Dependency Summary
External packages used:
- FastAPI + Pydantic (API framework)
- SQLAlchemy / sqlite3 (Database)
- Playwright (Web scraping)
- yfinance (Market data)
- pandas, numpy (Data processing)
- plotly (Charting - but only used in `data_provider.py`)

---

## Verification Plan
After refactoring each phase:
1. Run existing tests: `pytest backend/tests/`
2. Manual API testing: Start server with `uvicorn main:app --reload`
3. Verify frontend integration by testing each feature page
4. Check for import errors: `python -c "from main import app"`

---

## Completed Changes
- [x] Initial audit completed
- [x] Phase 1: Quick Fixes ✅
- [ ] Phase 2: Service Layer
- [ ] Phase 3: Route Slimming
- [ ] Phase 4: Scraper Consolidation
- [ ] Phase 5: Type Safety
- [ ] Phase 6: Testing Infrastructure

### Phase 1 Details (Completed)
- Fixed duplicate `done_detail_router` import in `main.py` (lines 47-48, 129-131)
- Updated `routes/__init__.py` to export all 9 routers
- Created `shared/utils/` directory with:
  - `common.py` (text processing, ticker extraction)
  - `broker_utils.py` (broker classification)
  - `ticker_utils.py` (ticker management)
- Created `config/settings.py` with centralized configuration
- Legacy `modules/*.py` files now re-export from `shared/utils/` for backward compatibility
