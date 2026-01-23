"""
Price Volume Routes - API endpoints for OHLCV candlestick data.

Provides endpoints to fetch stock price and volume data for visualization.
Uses yfinance for data retrieval with smart incremental fetching.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional
import logging
import yfinance as yf
import pandas as pd

from db.price_volume_repository import price_volume_repo
from db.market_metadata_repository import MarketMetadataRepository

# Initialize market metadata repo
market_meta_repo = MarketMetadataRepository()

router = APIRouter(prefix="/api", tags=["price-volume"])
logger = logging.getLogger(__name__)


def calculate_moving_averages(data: list, periods: list = [5, 10, 20]) -> dict:
    """
    Calculate moving averages for price and volume data.
    
    Args:
        data: List of OHLCV records
        periods: List of MA periods to calculate
        
    Returns:
        Dictionary with MA data for each period
    """
    if not data or len(data) < max(periods):
        return {f"ma{p}": [] for p in periods}
    
    closes = [d['close'] for d in data]
    volumes = [d['volume'] for d in data]
    times = [d['time'] for d in data]
    
    result = {}
    
    # Calculate price MAs
    for period in periods:
        ma_values = []
        for i in range(len(closes)):
            if i < period - 1:
                ma_values.append(None)
            else:
                window = closes[i - period + 1:i + 1]
                ma_values.append(sum(window) / period)
        
        result[f"ma{period}"] = [
            {"time": times[i], "value": ma_values[i]}
            for i in range(len(times))
            if ma_values[i] is not None
        ]
    
    # Calculate volume MA20
    volume_ma = []
    for i in range(len(volumes)):
        if i < 19:
            volume_ma.append(None)
        else:
            window = volumes[i - 19:i + 1]
            volume_ma.append(sum(window) / 20)
    
    result["volumeMa20"] = [
        {"time": times[i], "value": volume_ma[i]}
        for i in range(len(times))
        if volume_ma[i] is not None
    ]
    
    return result


# IMPORTANT: Static routes MUST come before dynamic routes like {ticker}
@router.post("/price-volume/refresh-all")
async def refresh_all_tickers():
    """
    Refresh OHLCV data for all existing tickers in the database.
    
    This endpoint fetches incremental data from yfinance for each ticker
    that already exists in the database, updating them to the latest date.
    
    Returns:
        {
            "tickers_processed": 27,
            "tickers_updated": 25,
            "total_records_added": 120,
            "results": [
                {"ticker": "BBCA", "status": "updated", "records_added": 5},
                {"ticker": "BBRI", "status": "updated", "records_added": 5},
                {"ticker": "ANTM", "status": "no_new_data", "records_added": 0}
            ],
            "errors": []
        }
    """
    try:
        tickers = price_volume_repo.get_all_tickers()
        
        if not tickers:
            return {
                "tickers_processed": 0,
                "tickers_updated": 0,
                "total_records_added": 0,
                "results": [],
                "errors": [],
                "message": "No tickers found in database. Add tickers first by searching them individually."
            }
        
        results = []
        errors = []
        total_records_added = 0
        tickers_updated = 0
        
        end_date = datetime.now()
        
        for ticker in tickers:
            try:
                latest_date = price_volume_repo.get_latest_date(ticker)
                
                if not latest_date:
                    results.append({
                        "ticker": ticker,
                        "status": "no_existing_data",
                        "records_added": 0
                    })
                    continue
                
                latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
                today = datetime.now().date()
                
                # Check if data is already up to date
                if latest_dt.date() >= today - timedelta(days=1):
                    results.append({
                        "ticker": ticker,
                        "status": "already_up_to_date",
                        "records_added": 0,
                        "latest_date": latest_date
                    })
                    continue
                
                # Fetch incremental data from yfinance
                fetch_start = latest_dt + timedelta(days=1)
                yf_ticker = f"{ticker}.JK"
                
                stock = yf.Ticker(yf_ticker)
                df = stock.history(
                    start=fetch_start.strftime('%Y-%m-%d'), 
                    end=end_date.strftime('%Y-%m-%d')
                )
                
                if df.empty:
                    results.append({
                        "ticker": ticker,
                        "status": "no_new_data",
                        "records_added": 0,
                        "latest_date": latest_date
                    })
                    continue
                
                # Convert DataFrame to list of records
                new_records = []
                for date_idx, row in df.iterrows():
                    new_records.append({
                        'time': date_idx.strftime('%Y-%m-%d'),
                        'open': float(row['Open']),
                        'high': float(row['High']),
                        'low': float(row['Low']),
                        'close': float(row['Close']),
                        'volume': int(row['Volume'])
                    })
                
                # Store in database
                records_added = price_volume_repo.upsert_ohlcv_data(ticker, new_records)
                total_records_added += records_added
                tickers_updated += 1
                
                new_latest = price_volume_repo.get_latest_date(ticker)
                
                results.append({
                    "ticker": ticker,
                    "status": "updated",
                    "records_added": records_added,
                    "previous_latest": latest_date,
                    "new_latest": new_latest
                })
                
                logger.info(f"Refreshed {ticker}: added {records_added} records")
                
            except Exception as e:
                logger.error(f"Error refreshing {ticker}: {e}")
                errors.append({
                    "ticker": ticker,
                    "error": str(e)
                })
        
        return {
            "tickers_processed": len(tickers),
            "tickers_updated": tickers_updated,
            "total_records_added": total_records_added,
            "results": results,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in refresh_all_tickers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh tickers: {str(e)}")


@router.get("/price-volume/unusual/scan")

async def scan_unusual_volumes(
    scan_days: int = Query(30, ge=7, le=90, description="Number of days to scan for unusual volumes"),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0, description="Minimum volume/median ratio to flag"),
    lookback_days: int = Query(20, ge=10, le=60, description="Days to calculate median baseline")
):
    """
    Scan all tickers for unusual volume events.
    
    Uses Median of lookback_days as baseline. Unusual = volume > min_ratio * median.
    
    Categories:
    - elevated: 2x - 3x median
    - high: 3x - 5x median
    - extreme: > 5x median
    
    Args:
        scan_days: Number of recent days to scan (default: 30)
        min_ratio: Minimum volume/median ratio to flag (default: 2.0)
        lookback_days: Days to calculate median baseline (default: 20)
        
    Returns:
        {
            "unusual_volumes": [...list of events...],
            "scan_params": {...},
            "total_tickers_scanned": 50,
            "unusual_count": 12
        }
    """
    try:
        unusual_volumes = price_volume_repo.detect_unusual_volumes(
            scan_days=scan_days,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
        
        tickers = price_volume_repo.get_all_tickers()
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d')
        
        return {
            "unusual_volumes": unusual_volumes,
            "scan_params": {
                "scan_days": scan_days,
                "lookback_days": lookback_days,
                "min_ratio": min_ratio,
                "start_date": start_date,
                "end_date": end_date
            },
            "total_tickers_scanned": len(tickers),
            "unusual_count": len(unusual_volumes)
        }
        
    except Exception as e:
        logger.error(f"Error scanning unusual volumes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan unusual volumes: {str(e)}")


@router.get("/price-volume/anomaly/scan")
async def scan_anomalies_with_scoring(
    scan_days: int = Query(30, ge=7, le=90, description="Number of days to scan"),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0, description="Minimum volume/median ratio"),
    lookback_days: int = Query(20, ge=10, le=60, description="Days for median calculation"),
    min_score: int = Query(40, ge=0, le=100, description="Minimum total score to include")
):
    """
    [Alpha Hunter Stage 1] Scan for anomalies with full composite scoring.
    
    This is the main entry point for Alpha Hunter Stage 1 scanner.
    Returns unusual volume events with:
    - Volume Score (0-40): Based on volume spike ratio
    - Compression Score (0-30): Based on sideways consolidation
    - Flow Impact Score (0-30): Based on value traded vs market cap
    - Total Score (0-100): Sum of all scores
    - Signal Level: FIRE (80+), HOT (60-79), WARM (40-59)
    
    Args:
        scan_days: Number of recent days to scan
        min_ratio: Minimum volume/median ratio to detect
        lookback_days: Days for median baseline calculation
        min_score: Minimum total score to include in results
        
    Returns:
        {
            "anomalies": [...list of scored events...],
            "scan_params": {...},
            "stats": {
                "total_scanned": int,
                "anomalies_found": int,
                "fire_count": int,
                "hot_count": int,
                "warm_count": int
            }
        }
    """
    try:
        scored_anomalies = price_volume_repo.scan_with_scoring(
            scan_days=scan_days,
            lookback_days=lookback_days,
            min_ratio=min_ratio,
            min_score=min_score
        )
        
        tickers = price_volume_repo.get_all_tickers()
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d')
        
        # Count by signal level
        fire_count = sum(1 for a in scored_anomalies if a.get('signal_level') == 'FIRE')
        hot_count = sum(1 for a in scored_anomalies if a.get('signal_level') == 'HOT')
        warm_count = sum(1 for a in scored_anomalies if a.get('signal_level') == 'WARM')
        
        return {
            "anomalies": scored_anomalies,
            "scan_params": {
                "scan_days": scan_days,
                "lookback_days": lookback_days,
                "min_ratio": min_ratio,
                "min_score": min_score,
                "start_date": start_date,
                "end_date": end_date
            },
            "stats": {
                "total_scanned": len(tickers),
                "anomalies_found": len(scored_anomalies),
                "fire_count": fire_count,
                "hot_count": hot_count,
                "warm_count": warm_count
            }
        }
        
    except Exception as e:
        logger.error(f"Error scanning anomalies with scoring: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan anomalies: {str(e)}")


@router.get("/price-volume/{ticker}/spike-markers")
async def get_spike_markers(
    ticker: str,
    lookback_days: int = Query(20, ge=10, le=60, description="Days to calculate median baseline"),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0, description="Minimum volume/median ratio to flag")
):
    """
    Get volume spike markers for a specific ticker to display on chart.
    
    Returns markers that can be overlaid on a price/volume chart to highlight
    unusual volume days.
    
    Categories:
    - elevated: 2x - 3x median (green)
    - high: 3x - 5x median (amber)  
    - extreme: > 5x median (red)
    
    Args:
        ticker: Stock ticker symbol
        lookback_days: Days to calculate median baseline (default: 20)
        min_ratio: Minimum volume/median ratio to flag (default: 2.0)
        
    Returns:
        {
            "ticker": "BBCA",
            "markers": [...list of spike markers...],
            "marker_count": 5
        }
    """
    ticker = ticker.upper()
    
    try:
        markers = price_volume_repo.get_volume_spike_markers(
            ticker=ticker,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
        
        return {
            "ticker": ticker,
            "markers": markers,
            "marker_count": len(markers)
        }
        
    except Exception as e:
        logger.error(f"Error getting spike markers for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get spike markers: {str(e)}")


@router.get("/price-volume/{ticker}/compression")
async def get_sideways_compression(
    ticker: str,
    days: int = Query(15, ge=5, le=30, description="Days to analyze for compression")
):
    """
    Get sideways compression analysis for a ticker.
    
    Detects if a stock has been consolidating (low volatility) which is
    a key indicator for potential breakout plays.
    
    Args:
        ticker: Stock ticker symbol
        days: Number of recent days to analyze (default: 15)
        
    Returns:
        {
            "ticker": "BBCA",
            "is_sideways": true,
            "compression_score": 25,
            "sideways_days": 15,
            "volatility_pct": 2.5,
            "price_range_pct": 5.2,
            "avg_close": 8050.0
        }
    """
    ticker = ticker.upper()
    
    try:
        compression = price_volume_repo.detect_sideways_compression(ticker, days)
        
        return {
            "ticker": ticker,
            **compression
        }
        
    except Exception as e:
        logger.error(f"Error getting compression for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze compression: {str(e)}")


@router.get("/price-volume/{ticker}/flow-impact")
async def get_flow_impact(
    ticker: str,
    date: str = Query(None, description="Date to analyze (YYYY-MM-DD), defaults to latest")
):
    """
    Get flow impact analysis for a ticker on a specific date.
    
    Calculates how significant the trading activity is relative to market cap.
    Flow Impact = (Volume × Close) / Market Cap × 100
    
    Args:
        ticker: Stock ticker symbol
        date: Date to analyze (defaults to latest trading date)
        
    Returns:
        {
            "ticker": "BBCA",
            "date": "2026-01-22",
            "flow_impact_pct": 1.25,
            "value_traded": 760000000000,
            "market_cap": 60800000000000,
            "flow_score": 15,
            "has_market_cap": true
        }
    """
    ticker = ticker.upper()
    
    # If no date provided, get latest date for this ticker
    if not date:
        date = price_volume_repo.get_latest_date(ticker)
        if not date:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    
    try:
        flow = price_volume_repo.calculate_flow_impact(ticker, date)
        
        return {
            "ticker": ticker,
            "date": date,
            **flow
        }
        
    except Exception as e:
        logger.error(f"Error getting flow impact for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate flow impact: {str(e)}")


@router.get("/price-volume/{ticker}")
async def get_price_volume(
    ticker: str,
    months: int = Query(9, ge=1, le=24, description="Number of months of historical data")
):
    """
    Get OHLCV data for a ticker with smart incremental fetching.
    
    This endpoint:
    1. Checks database for existing data
    2. If no data exists, fetches full history from yfinance
    3. If data exists, only fetches new data since last record
    4. Stores new data in database
    5. Returns all data with calculated moving averages
    
    Args:
        ticker: Stock ticker symbol (e.g., 'BBCA' for IDX stocks)
        months: Number of months of historical data to fetch (default: 9)
        
    Returns:
        {
            "ticker": "BBCA",
            "data": [...OHLCV records...],
            "ma5": [...],
            "ma10": [...],
            "ma20": [...],
            "volumeMa20": [...],
            "source": "database" | "fetched_full" | "fetched_incremental",
            "records_count": 180,
            "records_added": 5
        }
    """
    ticker = ticker.upper()
    yf_ticker = f"{ticker}.JK"  # IDX ticker format for Yahoo Finance
    
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        # Check existing data
        latest_date = price_volume_repo.get_latest_date(ticker)
        earliest_date = price_volume_repo.get_earliest_date(ticker)
        
        source = "database"
        records_added = 0
        
        # Determine if we need to fetch data
        need_fetch = False
        fetch_start = start_date
        
        if not latest_date:
            # No data exists, fetch everything
            need_fetch = True
            source = "fetched_full"
            logger.info(f"No existing data for {ticker}, fetching full {months} months")
        else:
            latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
            earliest_dt = datetime.strptime(earliest_date, '%Y-%m-%d')
            today = datetime.now().date()
            
            # Check if we need to fetch older data (if requested range is older than what we have)
            if start_date.date() < earliest_dt.date():
                need_fetch = True
                fetch_start = start_date
                source = "fetched_full"
                logger.info(f"Requested older data for {ticker}, fetching from {start_date.date()}")
            # Check if we need to fetch newer data
            elif latest_dt.date() < today - timedelta(days=1):
                need_fetch = True
                fetch_start = latest_dt + timedelta(days=1)
                source = "fetched_incremental"
                logger.info(f"Fetching incremental data for {ticker} from {fetch_start.date()}")
        
        # Fetch data from yfinance if needed
        if need_fetch:
            try:
                stock = yf.Ticker(yf_ticker)
                df = stock.history(start=fetch_start.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
                
                if df.empty:
                    logger.warning(f"No data returned from yfinance for {yf_ticker}")
                else:
                    # Convert DataFrame to list of records
                    new_records = []
                    for date_idx, row in df.iterrows():
                        new_records.append({
                            'time': date_idx.strftime('%Y-%m-%d'),
                            'open': float(row['Open']),
                            'high': float(row['High']),
                            'low': float(row['Low']),
                            'close': float(row['Close']),
                            'volume': int(row['Volume'])
                        })
                    
                    # Store in database
                    records_added = price_volume_repo.upsert_ohlcv_data(ticker, new_records)
                    logger.info(f"Stored {records_added} records for {ticker}")
                    
            except Exception as e:
                logger.error(f"Error fetching data from yfinance for {ticker}: {e}")
                # Continue with database data if fetch fails
        
        # Get all data from database
        data = price_volume_repo.get_ohlcv_data(
            ticker, 
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        if not data:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for ticker {ticker}. Make sure the ticker is valid (e.g., BBCA, ANTM, TLKM)"
            )
        
        # Calculate moving averages
        ma_data = calculate_moving_averages(data)
        
        return {
            "ticker": ticker,
            "data": data,
            "ma5": ma_data.get("ma5", []),
            "ma10": ma_data.get("ma10", []),
            "ma20": ma_data.get("ma20", []),
            "volumeMa20": ma_data.get("volumeMa20", []),
            "source": source,
            "records_count": len(data),
            "records_added": records_added
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_price_volume for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch price volume data: {str(e)}")


@router.get("/price-volume/{ticker}/exists")
async def check_ticker_data_exists(ticker: str):
    """
    Check if OHLCV data exists for a ticker in the database.
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        {
            "ticker": "BBCA",
            "exists": true,
            "record_count": 180,
            "latest_date": "2026-01-17",
            "earliest_date": "2025-04-20"
        }
    """
    ticker = ticker.upper()
    
    exists = price_volume_repo.has_data_for_ticker(ticker)
    record_count = price_volume_repo.get_record_count(ticker) if exists else 0
    latest_date = price_volume_repo.get_latest_date(ticker) if exists else None
    earliest_date = price_volume_repo.get_earliest_date(ticker) if exists else None
    
    return {
        "ticker": ticker,
        "exists": exists,
        "record_count": record_count,
        "latest_date": latest_date,
        "earliest_date": earliest_date
    }


@router.get("/price-volume/{ticker}/market-cap")
async def get_market_cap_data(
    ticker: str,
    days: int = Query(90, ge=7, le=365, description="Number of days of history")
):
    """
    Get current market cap and historical trend for a ticker.
    
    This endpoint:
    1. Fetches current market cap and shares outstanding from yfinance (cached)
    2. Returns historical market cap calculated from price × shares
    3. Auto-populates history from OHLCV data if not present
    
    Args:
        ticker: Stock ticker symbol
        days: Number of days of history (default: 90)
        
    Returns:
        {
            "ticker": "BBCA",
            "current_market_cap": 1234567890000,
            "shares_outstanding": 24655000000,
            "currency": "IDR",
            "change_1d_pct": 1.5,
            "change_7d_pct": 3.2,
            "change_30d_pct": -2.1,
            "history": [
                {"date": "2025-10-15", "market_cap": 1200000000000, "close_price": 9500}
            ]
        }
    """
    ticker = ticker.upper()
    
    try:
        # Get current market cap
        current_mcap = market_meta_repo.get_market_cap(ticker)
        shares = market_meta_repo.get_shares_outstanding(ticker)
        
        # Get history
        history = market_meta_repo.get_market_cap_history(ticker, days)
        
        # If no history, try to generate from OHLCV data
        if not history and shares:
            logger.info(f"No market cap history for {ticker}, generating from OHLCV...")
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            ohlcv_data = price_volume_repo.get_ohlcv_data(
                ticker, 
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            
            if ohlcv_data:
                saved = market_meta_repo.calculate_and_save_market_cap_from_ohlcv(
                    ticker, ohlcv_data, shares
                )
                logger.info(f"Generated {saved} market cap history records for {ticker}")
                history = market_meta_repo.get_market_cap_history(ticker, days)
        
        # Calculate changes
        change_1d = None
        change_7d = None
        change_30d = None
        
        if history and len(history) >= 2:
            latest = history[-1]['market_cap']
            
            if len(history) >= 2:
                prev_1d = history[-2]['market_cap']
                if prev_1d > 0:
                    change_1d = ((latest - prev_1d) / prev_1d) * 100
            
            if len(history) >= 7:
                prev_7d = history[-7]['market_cap']
                if prev_7d > 0:
                    change_7d = ((latest - prev_7d) / prev_7d) * 100
            
            if len(history) >= 30:
                prev_30d = history[-30]['market_cap']
                if prev_30d > 0:
                    change_30d = ((latest - prev_30d) / prev_30d) * 100
        
        return {
            "ticker": ticker,
            "current_market_cap": current_mcap,
            "shares_outstanding": shares,
            "currency": "IDR",
            "change_1d_pct": round(change_1d, 2) if change_1d is not None else None,
            "change_7d_pct": round(change_7d, 2) if change_7d is not None else None,
            "change_30d_pct": round(change_30d, 2) if change_30d is not None else None,
            "history": history,
            "history_count": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error fetching market cap for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch market cap data: {str(e)}")
