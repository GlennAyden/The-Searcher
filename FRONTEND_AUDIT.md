# Frontend Audit and Feature Modularization Plan

## Scope
- Audit of the Next.js frontend under `frontend/src`.
- Feature map plus target modularization layout.
- Candidate unused files based on import graph from `src/app` entrypoints.

## Current Structure Snapshot
- App router entrypoints live in `frontend/src/app`.
- Global layout: `frontend/src/app/layout.tsx` wraps pages with `Sidebar` and `FilterProvider`.
- Global state: `frontend/src/context/filter-context.tsx` provides `ticker` and `dateRange`.
- Data access:
  - Modular clients: `frontend/src/services/api/*`.
  - Direct `fetch` usage remains in Alpha Hunter (via `API_BASE_URL`).
- Shared UI:
  - `frontend/src/components/ui` (shadcn-style primitives).
  - `frontend/src/lib/utils.ts`, `frontend/src/lib/string-utils.ts`.
- Feature components:
  - `frontend/src/components/*` grouped by feature (alpha-hunter, done-detail, charts, rag-chat).
  - `frontend/src/features/dashboard/*` for the dashboard refactor.
  - `frontend/src/features/news/*` for the news library refactor.
  - `frontend/src/features/story-finder/*` for the story finder refactor.
  - `frontend/src/features/done-detail/*` for the done detail refactor.
  - `frontend/src/features/neobdm/summary/*` for the market summary refactor.
  - `frontend/src/features/neobdm/broker-summary/*` for the broker summary refactor.
  - `frontend/src/features/neobdm/tracker/*` for the flow tracker refactor.
  - `frontend/src/features/price-volume/*` for the price & volume refactor.

## Feature Map (Route -> Modules)
- / (redirect)
  - Entry: `frontend/src/app/page.tsx` redirects to `/dashboard`.
- /dashboard
  - Entry: `frontend/src/app/dashboard/page.tsx`
  - Components: `frontend/src/features/dashboard/components/sentiment-chart.tsx`, `frontend/src/features/dashboard/components/ticker-cloud.tsx`, `frontend/src/features/dashboard/components/MetricCard.tsx`
  - Data: `frontend/src/features/dashboard/services/dashboard-service.ts`, `frontend/src/features/dashboard/services/scraper-service.ts`
  - Shared: `frontend/src/context/filter-context.tsx`
- /news-library
  - Entry: `frontend/src/app/news-library/page.tsx`
  - Components: `frontend/src/features/news/components/news-feed.tsx`, `frontend/src/features/news/components/NewsLibraryFilters.tsx`
  - Data: `frontend/src/features/news/services/news-service.ts`
  - Shared: `frontend/src/context/filter-context.tsx`
- /story-finder
  - Entry: `frontend/src/app/story-finder/page.tsx`
  - Components: `frontend/src/features/story-finder/components/*`
  - Data: `frontend/src/features/story-finder/services/story-finder-service.ts`
  - Shared: `frontend/src/context/filter-context.tsx`
- /rag-chat
  - Entry: `frontend/src/app/rag-chat/page.tsx`
  - Components: `frontend/src/features/rag-chat/components/*` (MODULARIZED)
  - Hooks: `frontend/src/features/rag-chat/hooks/useRagChat.ts`
  - Data: `frontend/src/features/rag-chat/services/rag-chat-service.ts`
  - Shared: `frontend/src/context/filter-context.tsx`
- /neobdm-summary
  - Entry: `frontend/src/app/neobdm-summary/page.tsx`
  - Components: `frontend/src/features/neobdm/summary/components/*`
  - Data: `frontend/src/features/neobdm/summary/services/neobdm-summary-service.ts`
  - Shared: `frontend/src/lib/string-utils.ts`, `frontend/src/lib/utils.ts`
- /neobdm-tracker
  - Entry: `frontend/src/app/neobdm-tracker/page.tsx`
  - Components: `frontend/src/features/neobdm/tracker/components/*`
  - Hooks: `frontend/src/features/neobdm/tracker/hooks/useFlowTrackerData.ts`
  - Data: `frontend/src/services/api/neobdm.ts`
  - Shared: `frontend/src/lib/utils.ts`, `frontend/src/lib/string-utils.ts`
- /broker-summary
  - Entry: `frontend/src/app/broker-summary/page.tsx`
  - Components: `frontend/src/features/neobdm/broker-summary/components/*`
  - Hooks: `frontend/src/features/neobdm/broker-summary/hooks/useBrokerSummaryData.ts`
  - Data: `frontend/src/services/api/neobdm.ts`, `frontend/src/services/api/dashboard.ts`, `frontend/src/services/api/brokerFive.ts`
  - UI: `frontend/src/components/ui/*` (dialog, table, badge, button, scroll-area)
- /price-volume
  - Entry: `frontend/src/app/price-volume/page.tsx`
  - Components: `frontend/src/features/price-volume/components/*`
  - Hooks: `frontend/src/features/price-volume/hooks/usePriceVolumeData.ts`
  - Data: `frontend/src/services/api/priceVolume.ts`, `frontend/src/services/api/dashboard.ts`
- /alpha-hunter
  - Entry: `frontend/src/app/alpha-hunter/page.tsx`
  - Components: `frontend/src/components/alpha-hunter/*`
  - Data: direct `fetch` with `API_BASE_URL`
  - State: `frontend/src/components/alpha-hunter/AlphaHunterContext.tsx`
- /done-detail
  - Entry: `frontend/src/app/done-detail/page.tsx`
  - Components: `frontend/src/features/done-detail/components/*`
  - Hooks: `frontend/src/features/done-detail/hooks/useDoneDetailData.ts`
  - Data: `frontend/src/services/api/doneDetail.ts`
- /broker-stalker
  - Entry: `frontend/src/app/broker-stalker/page.tsx`
  - Status: prototype only, uses dummy data.

## Cross-Feature Modules
- Layout and nav: `frontend/src/components/layout/sidebar.tsx`, `frontend/src/components/layout/scraper-control.tsx`
- Global styles: `frontend/src/app/globals.css`
- Shared types: `frontend/src/types/market.ts`

## Validated and Removed Unused Files
Method: walk `frontend/src` imports starting from `frontend/src/app/**` entrypoints, then verify no importers.
These files were removed during cleanup.

- `frontend/src/components/alpha-hunter/PullbackHealthPanel.tsx`
- `frontend/src/components/alpha-hunter/SmartMoneyFlowPanel.tsx`
- `frontend/src/components/alpha-hunter/StageProgressIndicator.tsx`
- `frontend/src/components/alpha-hunter/SupplyAnalysisPanel.tsx`
- `frontend/src/components/charts/HybridChart.tsx`
- `frontend/src/components/charts/MarketCapChart.tsx`
- `frontend/src/components/done-detail-components/BattleTimelineChart.tsx`
- `frontend/src/components/done-detail-components/SpeedScatterPlot.tsx`
- `frontend/src/components/shared/Badge.tsx`
- `frontend/src/components/shared/Button.tsx`
- `frontend/src/components/shared/Card.tsx`
- `frontend/src/components/shared/EmptyState.tsx`
- `frontend/src/components/shared/ErrorDisplay.tsx`
- `frontend/src/components/shared/Loading.tsx`
- `frontend/src/components/shared/index.ts`
- `frontend/src/components/ui/slider.tsx`
- `frontend/src/components/ui/switch.tsx`
- `frontend/src/components/ui/toast.tsx`
- `frontend/src/components/ui/toaster.tsx`
- `frontend/src/components/ui/use-toast.ts`
- `frontend/src/hooks/index.ts`
- `frontend/src/hooks/useApi.ts`
- `frontend/src/hooks/useDashboard.ts`
- `frontend/src/hooks/useDisclosures.ts`
- `frontend/src/hooks/useNeoBDM.ts`
- `frontend/src/hooks/useNews.ts`
- `frontend/src/services/api/index.ts`

## Observations and Debt
- Very large page components:
  - `frontend/src/app/neobdm-summary/page.tsx`
  - `frontend/src/app/neobdm-tracker/page.tsx`
  - `frontend/src/app/broker-summary/page.tsx`
  - These should be broken into feature-level components and hooks.
- Mixed data access patterns:
  - Direct `fetch` usage in `frontend/src/components/alpha-hunter/*`.
- Duplicate or unused UI layer:
  - `frontend/src/components/shared/*` appears unused.
- Encoding issues:
  - Multiple files contain garbled emoji sequences (for example "ðŸ", "â€¢"), indicating text encoding mismatch.
  - These should be normalized to valid UTF-8 or removed for consistency.

## Refactor Status (Pending)
Not yet refactored into the feature-first layout or split into smaller modules:
- `frontend/src/components/alpha-hunter/*` (direct fetch, no centralized service layer).
- `frontend/src/app/broker-stalker/page.tsx` (prototype/dummy data).
- Feature migration to `frontend/src/features/*` is in progress (dashboard, news, story-finder, done detail, price-volume, neobdm summary, broker summary, neobdm tracker done).

## Target Modularization Layout (Feature First)
Proposed structure to keep `app` pages thin and move logic under `features`.

```
frontend/src/
  app/
    dashboard/
    news-library/
    story-finder/
    rag-chat/
    neobdm-summary/
    neobdm-tracker/
    broker-summary/
    price-volume/
    alpha-hunter/
    done-detail/
    broker-stalker/
  features/
    dashboard/
      components/
      hooks/
      services/
      types/
      index.ts
    news/
      components/
      services/
      types/
    story-finder/
      components/
      services/
      types/
    rag-chat/
      components/
      services/
      types/
    neobdm/
      summary/
      tracker/
      broker-summary/
      shared/
    price-volume/
      components/
      services/
      types/
    alpha-hunter/
      components/
      services/
      types/
      state/
    done-detail/
      components/
      services/
      types/
    prototypes/
      broker-stalker/
  shared/
    components/
      layout/
    context/
    lib/
    types/
    ui/
```

## Per-Feature Modularization Plan (Move Targets)
- Dashboard (done)
  - Moved `frontend/src/components/dashboard/*` -> `frontend/src/features/dashboard/components/*`
  - Added `frontend/src/features/dashboard/services/*` wrappers.
  - `frontend/src/app/dashboard/page.tsx` is now a thin container.
- News Library (done)
  - Moved `frontend/src/components/news-library/*` -> `frontend/src/features/news/components/*`
  - Added `frontend/src/features/news/services/*` wrappers and `frontend/src/features/news/hooks/useNewsLibrary.ts`.
- Story Finder (done)
  - Moved `frontend/src/app/story-finder/page.tsx` -> `frontend/src/features/story-finder/*`
  - Replaced direct `fetch` usage with a feature service and hook.
- RAG Chat (done)
  - Moved `frontend/src/components/rag-chat/*` → `frontend/src/features/rag-chat/components/*`
  - Created `useRagChat` hook for state management
  - Wrapped `disclosuresApi` in feature service `rag-chat-service.ts`
  - Split into modular components: DisclosureSidebar, ChatWorkspace, ChatHeader, MessageFeed, ChatInput
- NeoBDM Summary (done) + Tracker (done)
  - Moved summary page logic into `frontend/src/features/neobdm/summary/*`
  - Tracker refactored into `frontend/src/features/neobdm/tracker/*`
  - Shared helpers can move to `frontend/src/features/neobdm/shared/*`
- Broker Summary
  - Extracted components and hooks into `frontend/src/features/neobdm/broker-summary/*`.
- Price Volume
  - Moved `frontend/src/components/charts/*` used by price-volume into `frontend/src/features/price-volume/components/*`
  - Extracted search, header, chart, and analysis panels into feature modules with a data hook.
- Alpha Hunter (done)
  - Moved `frontend/src/components/alpha-hunter/*` → `frontend/src/features/alpha-hunter/components/*`
  - Moved context to `frontend/src/features/alpha-hunter/state/AlphaHunterContext.tsx`
  - Created `AlphaHunterContent` component for main layout
  - Stage components: Stage1Summary, Stage2VPACard, Stage3FlowCard, Stage4SupplyCard
  - All imports use shared API config (`API_BASE_URL`)
- Done Detail
  - Moved `frontend/src/components/done-detail-components/*` -> `frontend/src/features/done-detail/components/*`
  - Split `DoneDetailSection` into modular tabs (overview, imposter, speed, range) with a feature hook.
- Broker Stalker (prototype)
  - Move `frontend/src/app/broker-stalker/page.tsx` -> `frontend/src/features/prototypes/broker-stalker/*`
  - Keep dummy data isolated to avoid accidental production use.
- Shared
  - Move `frontend/src/components/layout/*` -> `frontend/src/shared/components/layout/*`
  - Move `frontend/src/context/filter-context.tsx` -> `frontend/src/shared/context/*`
  - Keep `frontend/src/components/ui/*` under `frontend/src/shared/ui/*` (or keep as-is but treat as shared).
  - Move `frontend/src/lib/*` -> `frontend/src/shared/lib/*`
  - Move `frontend/src/types/*` -> `frontend/src/shared/types/*`

## Refactor Sequence (Frontend)
1. Confirm unused file candidates and delete safely.
2. Standardize API access:
   - Remove hardcoded URLs.
   - Use modular clients under `frontend/src/services/api/*`.
   - Decide whether to keep or remove `frontend/src/services/api.ts`.
3. Extract large page sections into components and hooks.
4. Move files into `features/*` and update imports.
5. Create feature `index.ts` exports for cleaner imports.
6. Run lint/build and resolve import path issues.

## Open Questions
- Should Story Finder remain a standalone feature or merge into News Library?
- Is Broker Stalker expected to stay as a prototype or be removed?
- Do you want to keep the legacy `frontend/src/services/api.ts` wrapper or fully migrate to modular clients?

## Completed Changes
- Removed hardcoded `http://localhost:8000` usage in Alpha Hunter and Story Finder.
- Centralized API base URL usage across services via `API_BASE_URL` and trimmed trailing slashes.
- Standardized Price Volume service to use shared API base.
- Migrated all frontend imports off the legacy `frontend/src/services/api.ts` wrapper and removed the file.
- Cleaned unused files and removed lint errors (remaining lint warnings only).
- Refactored dashboard into `frontend/src/features/dashboard/*`, with a metrics hook and service wrappers.
- Refactored news library into `frontend/src/features/news/*`, with filter UI and a data hook.
- Refactored story finder into `frontend/src/features/story-finder/*`, with filters and a data hook.
- Refactored market summary (NeoBDM Summary) into `frontend/src/features/neobdm/summary/*`, with a summary hook and modular sections.
- Refactored broker summary into `frontend/src/features/neobdm/broker-summary/*`, splitting journey, floor price, top holders, broker five, and modals into feature components and hooks.
- Refactored NeoBDM flow tracker into `frontend/src/features/neobdm/tracker/*`, splitting header, hot signals, charts, history table, and data hook.
- Refactored done detail into `frontend/src/features/done-detail/*`, modularizing the page header, tabs, and data hook.
- Refactored price & volume into `frontend/src/features/price-volume/*`, modularizing chart components, search, and analysis sections with a data hook.
- Began component/hook extraction:
  - Done Detail: `DoneDetailHeader`, `DoneDetailPasteModal`, `useDoneDetailData`.
