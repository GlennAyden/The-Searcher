"""
Price Volume Routes - API endpoints for OHLCV candlestick data.

REFACTORED: Uses PriceVolumeService for business logic.
Routes are thin wrappers around service methods.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional
import logging
import yfinance as yf

from db.price_volume_repository import price_volume_repo
from features.price_volume import PriceVolumeService
from shared.utils.technical import calculate_moving_averages

router = APIRouter(prefix="/api", tags=["price-volume"])
logger = logging.getLogger(__name__)

# Service instance
pv_service = PriceVolumeService()


# ========================================================================
# Static routes (must come before dynamic routes like {ticker})
# ========================================================================

@router.post("/price-volume/refresh-all")
async def refresh_all_tickers():
    """Refresh OHLCV data for all existing tickers in the database."""
    try:
        tickers = pv_service.get_all_tickers()
        
        if not tickers:
            return {
                "tickers_processed": 0, "tickers_updated": 0, "total_records_added": 0,
                "results": [], "errors": [],
                "message": "No tickers found. Add tickers first by searching them individually."
            }
        
        results, errors = [], []
        total_records_added = 0
        tickers_updated = 0
        
        end_date = datetime.now()
        
        for ticker in tickers:
            try:
                latest_date = pv_service.get_latest_date(ticker)
                
                if not latest_date:
                    results.append({"ticker": ticker, "status": "no_existing_data", "records_added": 0})
                    continue
                
                latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
                
                if latest_dt.date() >= datetime.now().date() - timedelta(days=1):
                    results.append({"ticker": ticker, "status": "already_up_to_date", "records_added": 0, "latest_date": latest_date})
                    continue
                
                # Fetch incremental data
                fetch_start = latest_dt + timedelta(days=1)
                stock = yf.Ticker(f"{ticker}.JK")
                df = stock.history(start=fetch_start.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
                
                if df.empty:
                    results.append({"ticker": ticker, "status": "no_new_data", "records_added": 0, "latest_date": latest_date})
                    continue
                
                new_records = [
                    {'time': idx.strftime('%Y-%m-%d'), 'open': float(row['Open']), 'high': float(row['High']),
                     'low': float(row['Low']), 'close': float(row['Close']), 'volume': int(row['Volume'])}
                    for idx, row in df.iterrows()
                ]
                
                records_added = pv_service.upsert_ohlcv_data(ticker, new_records)
                total_records_added += records_added
                tickers_updated += 1
                
                results.append({"ticker": ticker, "status": "updated", "records_added": records_added,
                               "previous_latest": latest_date, "new_latest": pv_service.get_latest_date(ticker)})
                logger.info(f"Refreshed {ticker}: added {records_added} records")
                
            except Exception as e:
                logger.error(f"Error refreshing {ticker}: {e}")
                errors.append({"ticker": ticker, "error": str(e)})
        
        return {"tickers_processed": len(tickers), "tickers_updated": tickers_updated,
                "total_records_added": total_records_added, "results": results, "errors": errors}
        
    except Exception as e:
        logger.error(f"Error in refresh_all_tickers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh tickers: {str(e)}")


# ========================================================================
# Scanner Endpoints
# ========================================================================

@router.get("/price-volume/unusual/scan")
async def scan_unusual_volumes(
    scan_days: int = Query(30, ge=7, le=90),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0),
    lookback_days: int = Query(20, ge=10, le=60)
):
    """Scan all tickers for unusual volume events."""
    try:
        unusual = pv_service.detect_unusual_volumes(scan_days, lookback_days, min_ratio)
        tickers = pv_service.get_all_tickers()
        return {
            "unusual_volumes": unusual,
            "scan_params": {"scan_days": scan_days, "lookback_days": lookback_days, "min_ratio": min_ratio,
                           "start_date": (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d'),
                           "end_date": datetime.now().strftime('%Y-%m-%d')},
            "total_tickers_scanned": len(tickers),
            "unusual_count": len(unusual)
        }
    except Exception as e:
        logger.error(f"Error scanning unusual volumes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price-volume/anomaly/scan")
async def scan_anomalies_with_scoring(
    scan_days: int = Query(30, ge=7, le=90),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0),
    lookback_days: int = Query(20, ge=10, le=60),
    min_score: int = Query(40, ge=0, le=100)
):
    """[Alpha Hunter Stage 1] Scan for anomalies with full composite scoring."""
    try:
        anomalies = pv_service.scan_with_scoring(scan_days, lookback_days, min_ratio, min_score)
        tickers = pv_service.get_all_tickers()
        
        return {
            "anomalies": anomalies,
            "scan_params": {"scan_days": scan_days, "lookback_days": lookback_days, "min_ratio": min_ratio,
                           "min_score": min_score,
                           "start_date": (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d'),
                           "end_date": datetime.now().strftime('%Y-%m-%d')},
            "stats": {
                "total_scanned": len(tickers),
                "anomalies_found": len(anomalies),
                "fire_count": sum(1 for a in anomalies if a.get('signal_level') == 'FIRE'),
                "hot_count": sum(1 for a in anomalies if a.get('signal_level') == 'HOT'),
                "warm_count": sum(1 for a in anomalies if a.get('signal_level') == 'WARM')
            }
        }
    except Exception as e:
        logger.error(f"Error scanning anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Ticker-Specific Endpoints
# ========================================================================

@router.get("/price-volume/{ticker}/spike-markers")
async def get_spike_markers(
    ticker: str,
    lookback_days: int = Query(20, ge=10, le=60),
    min_ratio: float = Query(2.0, ge=1.5, le=10.0)
):
    """Get volume spike markers for chart overlay."""
    try:
        markers = pv_service.get_volume_spike_markers(ticker.upper(), lookback_days, min_ratio)
        return {"ticker": ticker.upper(), "markers": markers, "marker_count": len(markers)}
    except Exception as e:
        logger.error(f"Error getting spike markers for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price-volume/{ticker}/compression")
async def get_sideways_compression(ticker: str, days: int = Query(15, ge=5, le=30)):
    """Get sideways compression analysis for a ticker."""
    try:
        return {"ticker": ticker.upper(), **pv_service.get_sideways_compression(ticker.upper(), days)}
    except Exception as e:
        logger.error(f"Error getting compression for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price-volume/{ticker}/flow-impact")
async def get_flow_impact(ticker: str, date: str = Query(None)):
    """Get flow impact analysis for a ticker on a specific date."""
    ticker = ticker.upper()
    if not date:
        date = pv_service.get_latest_date(ticker)
        if not date:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    
    try:
        return {"ticker": ticker, "date": date, **pv_service.calculate_flow_impact(ticker, date)}
    except Exception as e:
        logger.error(f"Error getting flow impact for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price-volume/{ticker}/hk-analysis")
async def get_hk_analysis(
    ticker: str,
    spike_date: Optional[str] = Query(None),
    post_spike_days: int = Query(10, ge=3, le=30)
):
    """Get HK Methodology analysis (Smart Money Detection)."""
    try:
        result = pv_service.get_hk_analysis(ticker.upper(), spike_date, post_spike_days)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in HK analysis for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Main OHLCV Endpoint
# ========================================================================

@router.get("/price-volume/{ticker}")
async def get_price_volume(ticker: str, months: int = Query(9, ge=1, le=24)):
    """Get OHLCV data for a ticker with smart incremental fetching."""
    ticker = ticker.upper()
    yf_ticker = f"{ticker}.JK"
    
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        latest_date = pv_service.get_latest_date(ticker)
        earliest_date = pv_service.get_earliest_date(ticker)
        
        source = "database"
        records_added = 0
        
        need_fetch = False
        fetch_start = start_date
        
        if not latest_date:
            need_fetch = True
            source = "fetched_full"
            logger.info(f"No existing data for {ticker}, fetching full {months} months")
        else:
            latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
            earliest_dt = datetime.strptime(earliest_date, '%Y-%m-%d')
            
            if start_date.date() < earliest_dt.date():
                need_fetch = True
                source = "fetched_full"
            elif latest_dt.date() < datetime.now().date() - timedelta(days=1):
                need_fetch = True
                fetch_start = latest_dt + timedelta(days=1)
                source = "fetched_incremental"
        
        if need_fetch:
            try:
                stock = yf.Ticker(yf_ticker)
                df = stock.history(start=fetch_start.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
                
                if not df.empty:
                    new_records = [
                        {'time': idx.strftime('%Y-%m-%d'), 'open': float(row['Open']), 'high': float(row['High']),
                         'low': float(row['Low']), 'close': float(row['Close']), 'volume': int(row['Volume'])}
                        for idx, row in df.iterrows()
                    ]
                    records_added = pv_service.upsert_ohlcv_data(ticker, new_records)
                    logger.info(f"Fetched {len(new_records)} records for {ticker}")
            except Exception as e:
                logger.error(f"Error fetching from yfinance for {ticker}: {e}")
        
        # Get all data from database
        data = pv_service.get_ohlcv_data(ticker, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        
        if not data:
            empty_ma = calculate_moving_averages([])
            return {
                "ticker": ticker,
                "data": [],
                **empty_ma,
                "source": source,
                "records_count": 0,
                "records_added": records_added,
                "message": "No data found for ticker."
            }
        
        ma_data = calculate_moving_averages(data)
        
        return {
            "ticker": ticker,
            "data": data,
            **ma_data,
            "source": source,
            "records_count": len(data),
            "records_added": records_added
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_price_volume for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# Utility Endpoints
# ========================================================================

@router.get("/price-volume/{ticker}/exists")
async def check_ticker_data_exists(ticker: str):
    """Check if OHLCV data exists for a ticker."""
    ticker = ticker.upper()
    latest = pv_service.get_latest_date(ticker)
    earliest = pv_service.get_earliest_date(ticker)
    
    if not latest:
        return {"ticker": ticker, "exists": False, "record_count": 0}
    
    data = pv_service.get_ohlcv_data(ticker, earliest, latest)
    return {
        "ticker": ticker,
        "exists": True,
        "record_count": len(data),
        "latest_date": latest,
        "earliest_date": earliest
    }


@router.get("/price-volume/{ticker}/market-cap")
async def get_market_cap_data(ticker: str, days: int = Query(90, ge=7, le=365)):
    """Get current market cap and historical trend for a ticker."""
    from db.market_metadata_repository import MarketMetadataRepository
    market_meta_repo = MarketMetadataRepository()
    
    ticker = ticker.upper()
    yf_ticker = f"{ticker}.JK"
    
    try:
        # Fetch/cache market cap from yfinance
        try:
            stock = yf.Ticker(yf_ticker)
            info = stock.info
            market_cap = info.get('marketCap')
            shares_outstanding = info.get('sharesOutstanding')
            
            if market_cap and shares_outstanding:
                market_meta_repo.upsert_metadata(ticker, {
                    'market_cap': market_cap,
                    'shares_outstanding': shares_outstanding,
                    'last_updated': datetime.now().isoformat()
                })
        except Exception as e:
            logger.warning(f"Could not fetch market cap from yfinance for {ticker}: {e}")
            cached = market_meta_repo.get_metadata(ticker)
            market_cap = cached.get('market_cap') if cached else None
            shares_outstanding = cached.get('shares_outstanding') if cached else None
        
        # Calculate historical market cap from price data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        data = pv_service.get_ohlcv_data(ticker, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        
        history = []
        if shares_outstanding and data:
            for record in data:
                history.append({
                    "date": record['time'],
                    "market_cap": int(record['close'] * shares_outstanding),
                    "close_price": record['close']
                })
        
        return {
            "ticker": ticker,
            "current_market_cap": market_cap,
            "shares_outstanding": shares_outstanding,
            "history": history
        }
        
    except Exception as e:
        logger.error(f"Error getting market cap for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
