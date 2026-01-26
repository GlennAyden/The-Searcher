"""
API Routes for Alpha Hunter.

REFACTORED: Uses AlphaHunterService for business logic.
Routes are thin wrappers around service methods.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from datetime import datetime

from features.alpha_hunter import AlphaHunterService

router = APIRouter(prefix="/api/alpha-hunter", tags=["alpha_hunter"])

# Service instance
ah_service = AlphaHunterService()


# ========================================================================
# Stage 1: Scanning
# ========================================================================

@router.get("/scan")
async def scan_anomalies(
    min_score: int = 60,
    sector: Optional[str] = None,
    max_tickers: int = Query(100, ge=1, le=500),
    max_runtime_sec: int = Query(20, ge=5, le=120),
    use_market_cap: bool = Query(False)
):
    """[LEGACY] Scan market for volume anomalies (Stage 1 - volume-based)."""
    try:
        results = ah_service.scan_anomalies(
            min_score=min_score,
            sector=sector,
            max_tickers=max_tickers,
            max_runtime_sec=max_runtime_sec,
            use_market_cap=use_market_cap
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage1/scan")
async def stage1_flow_scanner(
    min_score: int = Query(45, ge=0, le=300),
    min_flow: float = Query(20.0, ge=0),
    max_price_change: float = Query(5.0, ge=0, le=20.0),
    strength_filter: Optional[str] = Query(None),
    pattern_filter: Optional[List[str]] = Query(None),
    price_value: Optional[float] = Query(None),
    price_operator: Optional[str] = Query(None),
    max_results: int = Query(20, ge=1, le=100)
):
    """
    [ALPHA HUNTER STAGE 1] Flow-Based Screening using NeoBDM Hot Signals.
    Uses fund flow patterns instead of volume spikes for early detection.
    """
    from modules.database import DatabaseManager
    db = DatabaseManager()
    
    try:
        hot_signals = db.get_latest_hot_signals()
        
        if not hot_signals:
            return {
                "total_signals": 0, "filtered_count": 0, "signals": [],
                "filters_applied": {"min_score": min_score, "min_flow": min_flow},
                "message": "No hot signals available."
            }
        
        # Apply filters
        positive_patterns = ['CONSISTENT_ACCUMULATION', 'ACCELERATING_BUILDUP', 'TREND_REVERSAL', 'SIDEWAYS_ACCUMULATION']
        filtered = []
        
        for signal in hot_signals:
            if signal.get('signal_score', 0) < min_score:
                continue
            if (signal.get('flow', 0) or 0) < min_flow:
                continue
            if abs(signal.get('change', 0) or 0) > max_price_change:
                continue
            
            # Price filter
            signal_price = signal.get('price', 0) or 0
            if price_value is not None and price_operator:
                ops = {'gt': lambda p, v: p > v, 'gte': lambda p, v: p >= v, 
                       'lt': lambda p, v: p < v, 'lte': lambda p, v: p <= v, 'eq': lambda p, v: p == v}
                if price_operator in ops and not ops[price_operator](signal_price, price_value):
                    continue
            
            if strength_filter and signal.get('signal_strength') != strength_filter:
                continue
            
            signal_patterns = [p.get('name', '') for p in signal.get('patterns', [])]
            if pattern_filter and not any(p in signal_patterns for p in pattern_filter):
                continue
            
            # Enrich signal
            has_positive = any(p in signal_patterns for p in positive_patterns)
            score = signal.get('signal_score', 0)
            
            signal['conviction'] = 'VERY_HIGH' if score >= 150 and has_positive else 'HIGH' if score >= 90 and has_positive else 'MEDIUM' if score >= 45 else 'LOW'
            signal['has_positive_pattern'] = has_positive
            signal['pattern_names'] = signal_patterns
            
            flow_val = signal.get('flow', 0) or 0
            price_chg = signal.get('change', 0) or 0
            signal['entry_zone'] = 'SWEET_SPOT' if -1 <= price_chg <= 3 and flow_val > 50 else 'ACCEPTABLE' if -3 <= price_chg <= 5 else 'RISKY'
            
            filtered.append(signal)
        
        filtered.sort(key=lambda x: x.get('signal_score', 0), reverse=True)
        total_filtered = len(filtered)
        filtered = filtered[:max_results]
        
        return {
            "total_signals": len(hot_signals),
            "filtered_count": len(filtered),
            "total_matches": total_filtered,
            "signals": filtered,
            "stats": {
                "by_conviction": {c: sum(1 for s in filtered if s.get('conviction') == c) for c in ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW']},
                "with_positive_pattern": sum(1 for s in filtered if s.get('has_positive_pattern')),
                "in_sweet_spot": sum(1 for s in filtered if s.get('entry_zone') == 'SWEET_SPOT')
            },
            "filters_applied": {"min_score": min_score, "min_flow": min_flow, "max_price_change": max_price_change,
                               "strength_filter": strength_filter, "pattern_filter": pattern_filter, "max_results": max_results}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stage 1 scan failed: {str(e)}")


# ========================================================================
# Stage 2: VPA Analysis
# ========================================================================

@router.get("/health/{ticker}")
async def get_pullback_health(ticker: str, spike_date: Optional[str] = None):
    """Analyze pullback health (Stage 2)."""
    try:
        return ah_service.get_pullback_health(ticker, spike_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage2/vpa/{ticker}")
async def get_stage2_vpa(
    ticker: str,
    lookback_days: int = Query(20, ge=10, le=60),
    pre_spike_days: int = Query(15, ge=5, le=40),
    post_spike_days: int = Query(10, ge=3, le=30),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0),
    persist_tracking: bool = Query(False)
):
    """Stage 2 VPA analysis."""
    try:
        result = ah_service.vpa.analyze_watchlist(
            ticker=ticker, lookback_days=lookback_days, pre_spike_days=pre_spike_days,
            post_spike_days=post_spike_days, min_ratio=min_ratio, persist_tracking=persist_tracking
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage2/visualization/{ticker}")
async def get_stage2_visualization(ticker: str, selling_climax_date: Optional[str] = Query(None)):
    """Stage 2 VPA Visualization Data."""
    try:
        result = ah_service.vpa.get_stage2_visualization_data(ticker=ticker, selling_climax_date=selling_climax_date)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Stage 3: Smart Money Flow
# ========================================================================

@router.get("/flow/{ticker}")
async def get_smart_money_flow(ticker: str, days: int = 7):
    """Get smart money flow analysis (Stage 3)."""
    try:
        return ah_service.flow.analyze_smart_money_flow(ticker, days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Stage 4: Supply Analysis
# ========================================================================

@router.get("/supply/{ticker}")
async def get_supply_analysis(ticker: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get supply analysis (Stage 4)."""
    try:
        return ah_service.supply.analyze_supply(ticker, analysis_start_date=start_date, analysis_end_date=end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-done-detail")
async def parse_done_detail(ticker: str = Body(...), raw_data: str = Body(...)):
    """Parse pasted Done Detail TSV data and analyze."""
    try:
        trades = ah_service.supply.parse_done_detail_tsv(raw_data)
        if not trades:
            return {"error": "No valid trades found", "trades_parsed": 0}
        result = ah_service.supply.analyze_supply(ticker, trades)
        result["trades_parsed"] = len(trades)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Watchlist Management
# ========================================================================

@router.get("/watchlist")
async def get_watchlist():
    """Get active investigation watchlist."""
    from modules.database import DatabaseManager
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    return {"watchlist": repo.get_watchlist()}


@router.post("/watchlist")
async def manage_watchlist(
    ticker: str = Body(...),
    action: str = Body(...),
    scan_data: Optional[dict] = Body(None)
):
    """Manage watchlist items."""
    from modules.database import DatabaseManager
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    
    if action == 'add':
        spike_date = scan_data.get('breakdown', {}).get('spike_date', datetime.now().strftime('%Y-%m-%d')) if scan_data else datetime.now().strftime('%Y-%m-%d')
        success = repo.add_to_watchlist(ticker, spike_date, scan_data.get('total_score', 0) if scan_data else 0, scan_data.get('breakdown', {}) if scan_data else {})
        return {"success": success}
    elif action == 'remove':
        return {"success": repo.remove_from_watchlist(ticker)}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/stage")
async def update_stage(ticker: str = Body(...), stage: int = Body(...)):
    """Update investigation stage for a ticker."""
    from modules.database import DatabaseManager
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    return {"success": repo.update_stage(ticker, stage)}


# ========================================================================
# Scraper Endpoint
# ========================================================================

@router.post("/scrape-broker/{ticker}")
async def trigger_broker_scrape(ticker: str, dates: List[str] = Body(...)):
    """Trigger broker summary scrape for specific dates."""
    from scrapers.neobdm_scraper import scrape_broker_summary
    
    ticker = ticker.upper()
    results, errors = [], []
    
    for date in dates:
        try:
            result = await scrape_broker_summary(ticker, date)
            results.append({"date": date, "status": "success"}) if result else errors.append({"date": date, "error": "No data"})
        except Exception as e:
            errors.append({"date": date, "error": str(e)})
    
    return {"ticker": ticker, "scraped": len(results), "failed": len(errors), "results": results, "errors": errors}
