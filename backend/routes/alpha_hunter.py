"""
API Routes for Alpha Hunter.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from datetime import datetime
from modules.alpha_hunter_scorer import AlphaHunterScorer
from modules.alpha_hunter_health import AlphaHunterHealth
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
    include_rt_status: bool = Query(False, description="Include real-time Flow Tracker status (slower)")
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
    from db.running_trade_repository import RunningTradeRepository
    
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
        
        # Optional: Enhance with Flow Tracker real-time status
        if include_rt_status:
            rt_repo = RunningTradeRepository()
            today = datetime.now().strftime('%Y-%m-%d')
            
            for signal in filtered_signals:
                ticker = signal.get('symbol', '')
                
                try:
                    # Get today's RT history
                    rt_df = rt_repo.get_rt_history(ticker, days=1)
                    
                    if not rt_df.empty:
                        # Analyze last few snapshots
                        recent = rt_df.head(3)  # Most recent 3 intervals (45 min)
                        
                        if len(recent) > 0:
                            total_buy = recent['buy_vol'].sum()
                            total_sell = recent['sell_vol'].sum()
                            net_vol = total_buy - total_sell
                            big_orders = recent['big_order_count'].sum() if 'big_order_count' in recent.columns else 0
                            
                            # Determine RT status
                            if net_vol > 0 and big_orders >= 5:
                                rt_status = 'STRONG_BUYING'
                                rt_bonus = 15
                            elif net_vol > 0:
                                rt_status = 'ACCUMULATION'
                                rt_bonus = 10
                            elif net_vol < 0 and abs(net_vol) > total_buy * 0.3:
                                rt_status = 'DISTRIBUTION'
                                rt_bonus = -15
                            else:
                                rt_status = 'NEUTRAL'
                                rt_bonus = 0
                            
                            signal['rt_status'] = rt_status
                            signal['rt_net_vol'] = int(net_vol)
                            signal['rt_big_orders'] = int(big_orders)
                            signal['rt_bonus'] = rt_bonus
                            
                            # Update score with RT bonus
                            signal['signal_score'] = signal.get('signal_score', 0) + rt_bonus
                        else:
                            signal['rt_status'] = 'NO_RECENT_DATA'
                    else:
                        signal['rt_status'] = 'NO_DATA'
                except Exception as rt_error:
                    signal['rt_status'] = 'ERROR'
                    signal['rt_error'] = str(rt_error)
        
        # Sort by signal score descending
        filtered_signals.sort(key=lambda x: x.get('signal_score', 0), reverse=True)
        
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
                "include_rt_status": include_rt_status
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
async def get_supply_analysis(ticker: str):
    """Get supply analysis (Stage 4)."""
    analyzer = AlphaHunterSupply()
    try:
        result = analyzer.analyze_supply(ticker)
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
