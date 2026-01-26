"""NeoBDM routes for market maker/non-retail/foreign flow analysis.

REFACTORED: Uses NeoBDMService for business logic.
Routes are thin wrappers around service methods.
"""
from fastapi import APIRouter, Query, BackgroundTasks, Body
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Optional, List, Union
from pydantic import BaseModel
import logging

from features.neobdm import NeoBDMService

router = APIRouter(prefix="/api", tags=["neobdm"])
logger = logging.getLogger(__name__)

# Service instance
neobdm_service = NeoBDMService()


# ========================================================================
# Pydantic Models
# ========================================================================

class BrokerSummaryBatchTask(BaseModel):
    ticker: str
    dates: List[str]


class BrokerJourneyRequest(BaseModel):
    ticker: str
    brokers: List[str]
    start_date: str
    end_date: str


# ========================================================================
# NeoBDM Summary Endpoints
# ========================================================================

@router.get("/neobdm-summary")
async def get_neobdm_summary(
    method: str = "m",
    period: str = "c",
    scrape: bool = Query(False),
    scrape_date: Optional[str] = None
):
    """Get NeoBDM market summary data."""
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()

    if scrape:
        try:
            from modules.scraper_neobdm import NeoBDMScraper
            scraper = NeoBDMScraper()
            await scraper.init_browser(headless=True)
            login_success = await scraper.login()
            if not login_success:
                return JSONResponse(status_code=401, content={"error": "Failed to login to NeoBDM"})
            
            df, reference_date = await scraper.get_market_summary(method=method, period=period)
            await scraper.close()
            
            if df is not None and not df.empty:
                data_list = df.to_dict(orient="records")
                scraped_at = reference_date if reference_date else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                neobdm_service.save_neobdm_record_batch(method, period, data_list, scraped_at)
                return {"scraped_at": scraped_at, "data": data_list}
            return {"scraped_at": None, "data": []}
        except Exception as e:
            logger.error(f"NeoBDM Summary scrape error: {e}")
            return {"error": str(e), "data": []}
    
    # Fetch from DB
    df = db_manager.get_neobdm_summaries(method=method, period=period, start_date=scrape_date, end_date=scrape_date)
    if df.empty:
        return {"scraped_at": None, "data": []}
    
    import json
    if 'data_json' in df.columns:
        latest = df.iloc[0]
        try:
            return {"scraped_at": latest['scraped_at'], "data": json.loads(latest['data_json'])}
        except:
            return {"scraped_at": None, "data": []}
    
    scraped_at = df.iloc[0]['scraped_at'] if 'scraped_at' in df.columns else None
    return {"scraped_at": scraped_at, "data": df.to_dict(orient="records")}


@router.get("/neobdm-dates")
def get_neobdm_dates():
    """Get list of available scrape dates."""
    return {"dates": neobdm_service.get_available_neobdm_dates()}


@router.get("/neobdm-tickers")
async def get_neobdm_tickers():
    """Get list of all tickers in NeoBDM data."""
    try:
        return {"tickers": neobdm_service.get_neobdm_tickers()}
    except Exception as e:
        logger.error(f"NeoBDM Tickers error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/neobdm-hot")
async def get_neobdm_hot():
    """Get hot signals - stocks with interesting flow patterns."""
    try:
        return {"signals": neobdm_service.get_latest_hot_signals()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ========================================================================
# Broker Summary Endpoints
# ========================================================================

@router.get("/neobdm-broker-summary")
async def get_neobdm_broker_summary(
    ticker: str,
    trade_date: str,
    scrape: bool = Query(False)
):
    """Get or scrape broker summary for a specific ticker and date."""
    ticker = ticker.upper()
    
    if scrape:
        try:
            from modules.scraper_neobdm import NeoBDMScraper
            scraper = NeoBDMScraper()
            await scraper.init_browser(headless=True)
            login_success = await scraper.login()
            
            if not login_success:
                return JSONResponse(status_code=401, content={"error": "NeoBDM login failed"})
            
            data = await scraper.get_broker_summary(ticker, trade_date)
            await scraper.close()
            
            if data and (data.get('buy') or data.get('sell')):
                neobdm_service.save_broker_summary_batch(ticker, trade_date, data.get('buy', []), data.get('sell', []))
                result = neobdm_service.get_broker_summary(ticker, trade_date)
                return {"ticker": ticker, "trade_date": trade_date, "buy": result.get('buy_data', []), "sell": result.get('sell_data', []), "source": "scraper"}
            return {"ticker": ticker, "trade_date": trade_date, "buy": [], "sell": [], "source": "scraper"}
            
        except Exception as e:
            logger.error(f"Broker Summary scrape error: {e}")
            return JSONResponse(status_code=500, content={"error": str(e)})
    
    # Fetch from DB
    data = neobdm_service.get_broker_summary(ticker, trade_date)
    return {"ticker": ticker, "trade_date": trade_date, "buy": data.get('buy_data', []), "sell": data.get('sell_data', []), "source": "database"}


@router.get("/neobdm-broker-summary/available-dates/{ticker}")
async def get_broker_summary_available_dates(ticker: str):
    """Get available dates for broker summary data."""
    try:
        dates = neobdm_service.get_available_dates_for_ticker(ticker.upper())
        return {"ticker": ticker.upper(), "available_dates": dates, "total_count": len(dates)}
    except Exception as e:
        logger.error(f"Error fetching available dates for {ticker}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/neobdm-broker-summary/journey")
async def get_broker_journey_data(request: BrokerJourneyRequest):
    """Get broker journey data showing accumulation/distribution over time."""
    try:
        if not request.brokers:
            return JSONResponse(status_code=400, content={"error": "At least one broker must be specified"})
        
        journey_data = neobdm_service.get_broker_journey(
            request.ticker.upper(), request.brokers, request.start_date, request.end_date
        )
        return journey_data
        
    except Exception as e:
        logger.error(f"Error fetching broker journey: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/neobdm-broker-summary/top-holders/{ticker}")
async def get_top_holders(ticker: str, limit: int = Query(3, ge=1, le=10)):
    """Get top holders by cumulative net lot."""
    try:
        return {"ticker": ticker.upper(), "top_holders": neobdm_service.get_top_holders_by_net_lot(ticker.upper(), limit)}
    except Exception as e:
        logger.error(f"Error fetching top holders for {ticker}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/neobdm-broker-summary/floor-price/{ticker}")
async def get_floor_price_analysis(ticker: str, days: int = Query(30, ge=0, le=365)):
    """Get floor price analysis based on institutional broker buy prices."""
    try:
        return neobdm_service.get_floor_price_analysis(ticker.upper(), days)
    except Exception as e:
        logger.error(f"Error fetching floor price for {ticker}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ========================================================================
# Broker Summary API (alternate endpoint)
# ========================================================================

@router.get("/broker-summary")
async def get_broker_summary_api(ticker: str, trade_date: str, scrape: bool = Query(False)):
    """Get broker summary data (alternate endpoint)."""
    ticker = ticker.upper()
    
    if not scrape:
        data = neobdm_service.get_broker_summary(ticker, trade_date)
        if data.get('buy_data') or data.get('sell_data'):
            return {"ticker": ticker, "trade_date": trade_date, "buy": data['buy_data'], "sell": data['sell_data'], "source": "database"}
    
    # Scrape
    from modules.scraper_neobdm import NeoBDMScraper
    scraper = NeoBDMScraper()
    try:
        await scraper.init_browser(headless=True)
        login_success = await scraper.login()
        if not login_success:
            return JSONResponse(status_code=401, content={"error": "Failed to login to NeoBDM"})
        
        scraped_data = await scraper.get_broker_summary(ticker, trade_date)
        
        if scraped_data and (scraped_data['buy'] or scraped_data['sell']):
            neobdm_service.save_broker_summary_batch(ticker, trade_date, scraped_data['buy'], scraped_data['sell'])
            data = neobdm_service.get_broker_summary(ticker, trade_date)
            return {"ticker": ticker, "trade_date": trade_date, "buy": data['buy_data'], "sell": data['sell_data'], "source": "scraper"}
        else:
            return JSONResponse(status_code=404, content={"error": f"No data found for {ticker} on {trade_date}"})
            
    except Exception as e:
        logger.error(f"Broker Summary API error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        await scraper.close()


# ========================================================================
# History Endpoint
# ========================================================================

@router.get("/neobdm-history")
@router.get("/neobdm/history")
def get_neobdm_history(symbol: str = None, ticker: str = None, method: str = "m", period: str = "c", limit: int = 30):
    """Get historical money flow data for a ticker."""
    from modules.database import DatabaseManager
    from data_provider import data_provider
    
    stock_symbol = symbol or ticker
    if not stock_symbol:
        return JSONResponse(status_code=400, content={"error": "Missing required parameter: symbol or ticker"})
    
    try:
        db_manager = DatabaseManager()
        history_data = db_manager.get_neobdm_history(stock_symbol.upper(), method, period, limit)
        
        market_cap = data_provider.get_market_cap(stock_symbol)
        if market_cap:
            for record in history_data:
                record['market_cap'] = market_cap
                flow_d0 = record.get('flow_d0', 0)
                if flow_d0 != 0:
                    flow_impact = data_provider.calculate_flow_impact(flow_d0, market_cap)
                    record['flow_impact_pct'] = flow_impact['impact_pct']
                    record['impact_label'] = flow_impact['impact_label']
                    record['normalized_flow'] = flow_impact['flow_idr']
                else:
                    record['flow_impact_pct'] = 0.0
                    record['impact_label'] = 'MINIMAL'
                    record['normalized_flow'] = 0.0
        
        return {"symbol": stock_symbol.upper(), "history": history_data}
    
    except Exception as e:
        logger.error(f"Error fetching NeoBDM history: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ========================================================================
# Batch Sync Endpoints (use service)
# ========================================================================

@router.post("/neobdm-batch-scrape")
async def run_neobdm_batch_scrape(background_tasks: BackgroundTasks):
    """Full synchronization of all NeoBDM data (Background Task)."""
    background_tasks.add_task(neobdm_service.perform_full_sync)
    return {"status": "processing", "message": "Full synchronization started in the background."}


@router.post("/neobdm-broker-summary-batch")
async def run_neobdm_broker_summary_batch(
    background_tasks: BackgroundTasks,
    tasks: Union[List[BrokerSummaryBatchTask], BrokerSummaryBatchTask] = Body(...)
):
    """Trigger batch scraping for multiple tickers and dates."""
    if not tasks:
        return JSONResponse(status_code=400, content={"error": "No batch tasks provided"})
    
    if isinstance(tasks, BrokerSummaryBatchTask):
        tasks_payload = [tasks.dict()]
    else:
        tasks_payload = [task.dict() for task in tasks]

    if not tasks_payload:
        return JSONResponse(status_code=400, content={"error": "No batch tasks provided"})
    background_tasks.add_task(neobdm_service.perform_broker_summary_batch_sync, tasks_payload)
    return {"status": "processing", "message": f"Scrape job started for {len(tasks_payload)} tickers."}


# ========================================================================
# Volume Daily Endpoint
# ========================================================================

@router.get("/volume-daily")
async def get_volume_daily(ticker: str):
    """Get daily volume data with smart incremental fetching."""
    from db.neobdm_repository import NeoBDMRepository
    
    try:
        neobdm_repo = NeoBDMRepository()
        return neobdm_repo.get_or_fetch_volume(ticker.upper())
    except Exception as e:
        logger.error(f"Error fetching volume data for {ticker}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
