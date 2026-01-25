"""
API Routes for Alpha Hunter.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from datetime import datetime
from modules.alpha_hunter_scorer import AlphaHunterScorer
from modules.alpha_hunter_health import AlphaHunterHealth
from modules.alpha_hunter_vpa import AlphaHunterStage2VPA
from modules.alpha_hunter_flow import AlphaHunterFlow
from modules.alpha_hunter_supply import AlphaHunterSupply
from modules.database import DatabaseManager

router = APIRouter(prefix="/api/alpha-hunter", tags=["alpha_hunter"])

@router.get("/scan")
async def scan_anomalies(
    min_score: int = 60,
    sector: Optional[str] = None
):
    """[LEGACY] Scan market for volume anomalies (Stage 1 - volume-based)."""
    scorer = AlphaHunterScorer()
    try:
        results = scorer.scan_market(min_score=min_score, sector=sector)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage1/scan")
async def stage1_flow_scanner(
    min_score: int = Query(45, ge=0, le=300, description="Minimum signal score"),
    min_flow: float = Query(20.0, ge=0, description="Minimum flow in millions"),
    max_price_change: float = Query(5.0, ge=0, le=20.0, description="Max absolute price change %"),
    strength_filter: Optional[str] = Query(None, description="Filter by strength: VERY_STRONG, STRONG, MODERATE"),
    pattern_filter: Optional[List[str]] = Query(
        None,
        description="Required patterns (at least one): CONSISTENT_ACCUMULATION, ACCELERATING_BUILDUP, TREND_REVERSAL, SIDEWAYS_ACCUMULATION"
    ),
    price_value: Optional[float] = Query(None, description="Price threshold value for filtering"),
    price_operator: Optional[str] = Query(None, description="Price comparison: gt (>), gte (>=), lt (<), lte (<=), eq (=)"),
    max_results: int = Query(20, ge=1, le=100, description="Maximum number of results to return")
):
    """
    [ALPHA HUNTER STAGE 1] Flow-Based Screening using NeoBDM Hot Signals.
    
    **NEW APPROACH**: Uses fund flow patterns instead of volume spikes for early detection.
    
    **Scoring Components**:
    - Flow Magnitude (0-50 pts): Today's flow strength
    - Price Sweet Spot (-30 to +15 pts): Ideal entry zone
    - Flow-Price Synergy (-20 to +30 pts): Big flow + low price = IDEAL
    - Timeframe Alignment (0-60 pts): D+W+C all positive
    - Momentum Analysis (0-40 pts): Velocity + Acceleration
    - Pattern Recognition (-40 to +40 pts): 6 key patterns
    - Multi-Method Confluence (0-50 pts): MM + NonRetail + Foreign
    
    **Patterns Detected**:
    - ✅ CONSISTENT_ACCUMULATION: All daily flows positive
    - 🚀 ACCELERATING_BUILDUP: Each day > previous day
    - 🔄 TREND_REVERSAL: Week 2 negative, Week 1 positive
    - 📊 SIDEWAYS_ACCUMULATION: High cumulative, low velocity
    - ⚡ SUDDEN_SPIKE: Today huge, history weak (avoid)
    - ❌ DISTRIBUTION: All negative flows (avoid)
    
    Returns filtered high-conviction signals sorted by score.
    """
    from modules.database import DatabaseManager
    
    db = DatabaseManager()
    
    try:
        # Get hot signals from NeoBDM
        hot_signals = db.get_latest_hot_signals()
        
        if not hot_signals:
            return {
                "total_signals": 0,
                "filtered_count": 0,
                "signals": [],
                "filters_applied": {
                    "min_score": min_score,
                    "min_flow": min_flow,
                    "max_price_change": max_price_change,
                    "strength_filter": strength_filter,
                    "pattern_filter": pattern_filter
                },
                "message": "No hot signals available. Check if NeoBDM data has been scraped."
            }
        
        # Define positive patterns (accumulation signals)
        positive_patterns = [
            'CONSISTENT_ACCUMULATION',
            'ACCELERATING_BUILDUP',
            'TREND_REVERSAL',
            'SIDEWAYS_ACCUMULATION'
        ]
        
        # Apply filters
        filtered_signals = []
        
        for signal in hot_signals:
            # Filter 1: Score threshold
            if signal.get('signal_score', 0) < min_score:
                continue
            
            # Filter 2: Flow magnitude
            flow_value = signal.get('flow', 0) or 0
            if flow_value < min_flow:
                continue
            
            # Filter 3: Price sweet spot (not too late or too early crash)
            price_change = signal.get('change', 0) or 0
            if abs(price_change) > max_price_change:
                continue
            
            # Filter 3b: Price value filter with operator
            signal_price = signal.get('price', 0) or 0
            if price_value is not None and price_operator:
                if price_operator == 'gt' and not (signal_price > price_value):
                    continue
                elif price_operator == 'gte' and not (signal_price >= price_value):
                    continue
                elif price_operator == 'lt' and not (signal_price < price_value):
                    continue
                elif price_operator == 'lte' and not (signal_price <= price_value):
                    continue
                elif price_operator == 'eq' and not (signal_price == price_value):
                    continue
            
            # Filter 4: Strength filter (if specified)
            if strength_filter and signal.get('signal_strength') != strength_filter:
                continue
            
            # Filter 5: Pattern matching (if specified)
            signal_patterns = [p.get('name', '') for p in signal.get('patterns', [])]
            
            if pattern_filter:
                # At least one specified pattern must match
                if not any(p in signal_patterns for p in pattern_filter):
                    continue
            else:
                # Default: prefer signals with at least one positive pattern
                # But don't filter out if no patterns specified
                pass
            
            # Enhance signal with pattern analysis metadata
            has_positive_pattern = any(p in signal_patterns for p in positive_patterns)
            has_distribution = 'DISTRIBUTION' in signal_patterns
            has_sudden_spike = 'SUDDEN_SPIKE' in signal_patterns
            
            # Calculate conviction level
            score = signal.get('signal_score', 0)
            if score >= 150 and has_positive_pattern and not has_distribution:
                conviction = 'VERY_HIGH'
            elif score >= 90 and has_positive_pattern:
                conviction = 'HIGH'
            elif score >= 45 and not has_distribution:
                conviction = 'MEDIUM'
            else:
                conviction = 'LOW'
            
            # Add metadata
            signal['conviction'] = conviction
            signal['has_positive_pattern'] = has_positive_pattern
            signal['pattern_names'] = signal_patterns
            
            # Entry zone assessment
            if -1 <= price_change <= 3 and flow_value > 50:
                signal['entry_zone'] = 'SWEET_SPOT'
            elif -3 <= price_change <= 5:
                signal['entry_zone'] = 'ACCEPTABLE'
            else:
                signal['entry_zone'] = 'RISKY'
            
            filtered_signals.append(signal)
        
        # Sort by signal score descending
        filtered_signals.sort(key=lambda x: x.get('signal_score', 0), reverse=True)
        
        # Store total filtered count before limiting
        total_filtered = len(filtered_signals)
        
        # Apply max_results limit
        filtered_signals = filtered_signals[:max_results]
        
        # Statistics
        conviction_counts = {
            'VERY_HIGH': sum(1 for s in filtered_signals if s.get('conviction') == 'VERY_HIGH'),
            'HIGH': sum(1 for s in filtered_signals if s.get('conviction') == 'HIGH'),
            'MEDIUM': sum(1 for s in filtered_signals if s.get('conviction') == 'MEDIUM'),
            'LOW': sum(1 for s in filtered_signals if s.get('conviction') == 'LOW')
        }
        
        strength_counts = {
            'VERY_STRONG': sum(1 for s in filtered_signals if s.get('signal_strength') == 'VERY_STRONG'),
            'STRONG': sum(1 for s in filtered_signals if s.get('signal_strength') == 'STRONG'),
            'MODERATE': sum(1 for s in filtered_signals if s.get('signal_strength') == 'MODERATE'),
            'WEAK': sum(1 for s in filtered_signals if s.get('signal_strength') == 'WEAK')
        }
        
        return {
            "total_signals": len(hot_signals),
            "filtered_count": len(filtered_signals),
            "total_matches": total_filtered,
            "signals": filtered_signals,
            "stats": {
                "by_conviction": conviction_counts,
                "by_strength": strength_counts,
                "with_positive_pattern": sum(1 for s in filtered_signals if s.get('has_positive_pattern')),
                "in_sweet_spot": sum(1 for s in filtered_signals if s.get('entry_zone') == 'SWEET_SPOT')
            },
            "filters_applied": {
                "min_score": min_score,
                "min_flow": min_flow,
                "max_price_change": max_price_change,
                "strength_filter": strength_filter,
                "pattern_filter": pattern_filter,
                "price_value": price_value,
                "price_operator": price_operator,
                "max_results": max_results
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stage 1 scan failed: {str(e)}")

@router.get("/health/{ticker}")
async def get_pullback_health(
    ticker: str,
    spike_date: Optional[str] = None
):
    """Analyze pullback health (Stage 2)."""
    tracker = AlphaHunterHealth()
    try:
        result = tracker.check_pullback_health(ticker, spike_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage2/vpa/{ticker}")
async def get_stage2_vpa(
    ticker: str,
    lookback_days: int = Query(20, ge=10, le=60, description="Baseline days for median volume"),
    pre_spike_days: int = Query(15, ge=5, le=40, description="Days to evaluate compression before spike"),
    post_spike_days: int = Query(10, ge=3, le=30, description="Days to evaluate pullback after spike"),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0, description="Min volume/median ratio for auto spike detection"),
    persist_tracking: bool = Query(False, description="Persist daily pullback snapshots to tracking table")
):
    """Stage 2 VPA analysis based on watchlist entry."""
    analyzer = AlphaHunterStage2VPA()
    try:
        result = analyzer.analyze_watchlist(
            ticker=ticker,
            lookback_days=lookback_days,
            pre_spike_days=pre_spike_days,
            post_spike_days=post_spike_days,
            min_ratio=min_ratio,
            persist_tracking=persist_tracking
        )
        if result.get("error"):
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stage2/visualization/{ticker}")
async def get_stage2_visualization(
    ticker: str,
    selling_climax_date: Optional[str] = Query(
        None, 
        description="Override selling climax date (YYYY-MM-DD)"
    )
):
    """
    Stage 2 VPA Visualization Data.
    
    Returns:
    - price_chart: OHLCV + MA5/10/20 + event markers
    - volume_chart: Volume bars + MA20 + spike labels
    - money_flow_chart: Positive/negative flow bars + price overlay
    - resistance_lines: Horizontal lines from volume spike+UP until broken
    - recommendation: Trading action based on current state
    """
    analyzer = AlphaHunterStage2VPA()
    try:
        result = analyzer.get_stage2_visualization_data(
            ticker=ticker,
            selling_climax_date=selling_climax_date
        )
        if result.get("error"):
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/flow/{ticker}")
async def get_smart_money_flow(
    ticker: str,
    days: int = 7
):
    """Get smart money flow analysis (Stage 3)."""
    analyzer = AlphaHunterFlow()
    try:
        result = analyzer.analyze_smart_money_flow(ticker, days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scrape-broker/{ticker}")
async def trigger_broker_scrape(
    ticker: str,
    dates: List[str] = Body(...)
):
    """Trigger broker summary scrape for specific dates."""
    from scrapers.neobdm_scraper import scrape_broker_summary
    
    ticker = ticker.upper()
    results = []
    errors = []
    
    for date in dates:
        try:
            result = await scrape_broker_summary(ticker, date)
            if result:
                results.append({"date": date, "status": "success"})
            else:
                errors.append({"date": date, "error": "No data returned"})
        except Exception as e:
            errors.append({"date": date, "error": str(e)})
    
    return {
        "ticker": ticker,
        "scraped": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@router.get("/watchlist")
async def get_watchlist():
    """Get active investigation watchlist."""
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    return {"watchlist": repo.get_watchlist()}

@router.post("/watchlist")
async def manage_watchlist(
    ticker: str = Body(...),
    action: str = Body(...), # 'add', 'remove', 'import_scan'
    scan_data: Optional[dict] = Body(None)
):
    """Manage watchlist items."""
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    
    if action == 'add':
        # Manual add or from scan
        spike_date = scan_data.get('breakdown', {}).get('spike_date', datetime.now().strftime('%Y-%m-%d')) if scan_data else datetime.now().strftime('%Y-%m-%d')
        score = scan_data.get('total_score', 0) if scan_data else 0
        info = scan_data.get('breakdown', {}) if scan_data else {}
        
        success = repo.add_to_watchlist(ticker, spike_date, score, info)
        return {"success": success}
        
    elif action == 'remove':
        success = repo.remove_from_watchlist(ticker)
        return {"success": success}
        
    raise HTTPException(status_code=400, detail="Invalid action")

@router.post("/stage")
async def update_stage(
    ticker: str = Body(...),
    stage: int = Body(...)
):
    """Update investigation stage for a ticker."""
    db = DatabaseManager()
    repo = db.get_alpha_hunter_repo()
    success = repo.update_stage(ticker, stage)
    return {"success": success}

@router.get("/supply/{ticker}")
async def get_supply_analysis(
    ticker: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get supply analysis (Stage 4)."""
    analyzer = AlphaHunterSupply()
    try:
        result = analyzer.analyze_supply(
            ticker,
            analysis_start_date=start_date,
            analysis_end_date=end_date
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse-done-detail")
async def parse_done_detail(
    ticker: str = Body(...),
    raw_data: str = Body(...)
):
    """Parse pasted Done Detail TSV data and analyze."""
    analyzer = AlphaHunterSupply()
    try:
        # Parse TSV
        trades = analyzer.parse_done_detail_tsv(raw_data)
        if not trades:
            return {"error": "No valid trades found in data", "trades_parsed": 0}
        
        # Analyze
        result = analyzer.analyze_supply(ticker, trades)
        result["trades_parsed"] = len(trades)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
