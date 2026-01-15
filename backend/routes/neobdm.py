"""NeoBDM routes for market maker/non-retail/foreign flow analysis."""
from fastapi import APIRouter, Query, BackgroundTasks, Body
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
import logging
import asyncio
import json

router = APIRouter(prefix="/api", tags=["neobdm"])


class BrokerSummaryBatchTask(BaseModel):
    ticker: str
    dates: List[str]


@router.get("/neobdm-summary")
async def get_neobdm_summary(
    method: str = "m",
    period: str = "c",
    scrape: bool = Query(False),
    scrape_date: Optional[str] = None
):
    """
    Get NeoBDM market summary data.
    
    Args:
        method: Analysis method ('m'=Market Maker, 'nr'=Non-Retail, 'f'=Foreign Flow)
        period: Time period ('d'=Daily, 'c'=Cumulative)
        scrape: If True, scrape fresh data from NeoBDM website
        scrape_date: Specific date to fetch from database (YYYY-MM-DD)
    
    Returns:
        Scraped_at timestamp and data array
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()

    if scrape:
        try:
            from modules.scraper_neobdm import NeoBDMScraper
            scraper = NeoBDMScraper()
            await scraper.init_browser(headless=True)
            login_success = await scraper.login()
            if not login_success:
                return JSONResponse(
                    status_code=401, 
                    content={"error": "Failed to login to NeoBDM"}
                )
            
            df, reference_date = await scraper.get_market_summary(method=method, period=period)
            await scraper.close()
            
            if df is not None and not df.empty:
                data_list = df.to_dict(orient="records")
                scraped_at = reference_date if reference_date else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                db_manager.save_neobdm_record_batch(method, period, data_list, scraped_at=scraped_at)
                return {
                    "scraped_at": scraped_at,
                    "data": data_list
                }
            return {"scraped_at": None, "data": []}
        except Exception as e:
            logging.error(f"NeoBDM Summary scrape error: {e}")
            return {"error": str(e), "data": []}
    else:
        # Fetch from DB
        df = db_manager.get_neobdm_summaries(
            method=method, 
            period=period, 
            start_date=scrape_date, 
            end_date=scrape_date
        )
        if df.empty:
            return {"scraped_at": None, "data": []}
        
        # Handle legacy format with data_json
        if 'data_json' in df.columns:
            latest = df.iloc[0]
            try:
                data_list = json.loads(latest['data_json'])
                scraped_at = latest['scraped_at']
                return {
                    "scraped_at": scraped_at,
                    "data": data_list
                }
            except:
                return {"scraped_at": None, "data": []}
        
        # New structure returns individual rows
        scraped_at = df.iloc[0]['scraped_at'] if 'scraped_at' in df.columns else None
        
        return {
            "scraped_at": scraped_at,
            "data": df.to_dict(orient="records")
        }


@router.get("/neobdm-broker-summary")
async def get_neobdm_broker_summary(
    ticker: str,
    trade_date: str,
    scrape: bool = Query(False)
):
    """
    Get or scrape broker summary for a specific ticker and date.
    
    Args:
        ticker: Stock ticker
        trade_date: Trade date (YYYY-MM-DD)
        scrape: Whether to force scrape fresh data
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()

    if scrape:
        try:
            from modules.scraper_neobdm import NeoBDMScraper
            scraper = NeoBDMScraper()
            await scraper.init_browser(headless=True)
            login_success = await scraper.login()
            
            if not login_success:
                return JSONResponse(status_code=401, content={"error": "NeoBDM login failed"})
            
            data = await scraper.get_broker_summary(ticker.upper(), trade_date)
            await scraper.close()
            
            if data and (data.get('buy') or data.get('sell')):
                db_manager.save_broker_summary_batch(
                    ticker.upper(), 
                    trade_date, 
                    data.get('buy', []), 
                    data.get('sell', [])
                )
                normalized = db_manager.get_broker_summary(ticker.upper(), trade_date)
                return {
                    "ticker": ticker.upper(),
                    "trade_date": trade_date,
                    "buy": normalized.get('buy', []),
                    "sell": normalized.get('sell', []),
                    "source": "scraper"
                }
            return {
                "ticker": ticker.upper(),
                "trade_date": trade_date,
                "buy": [],
                "sell": [],
                "source": "scraper"
            }
            
        except Exception as e:
            logging.error(f"Broker Summary scrape error: {e}")
            return JSONResponse(status_code=500, content={"error": str(e)})
    else:
        # Fetch from DB
        data = db_manager.get_broker_summary(ticker.upper(), trade_date)
        return {
            "ticker": ticker.upper(),
            "trade_date": trade_date,
            "buy": data.get('buy', []),
            "sell": data.get('sell', []),
            "source": "database"
        }


@router.get("/neobdm-broker-summary/available-dates/{ticker}")
async def get_broker_summary_available_dates(ticker: str):
    """
    Get list of available dates where broker summary data exists for a ticker.
    
    Args:
        ticker: Stock ticker
    
    Returns:
        List of dates with data available
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    
    try:
        dates = db_manager.get_available_dates_for_ticker(ticker.upper())
        return {
            "ticker": ticker.upper(),
            "available_dates": dates,
            "total_count": len(dates)
        }
    except Exception as e:
        logging.error(f"Error fetching available dates for {ticker}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


class BrokerJourneyRequest(BaseModel):
    ticker: str
    brokers: List[str]
    start_date: str
    end_date: str


@router.post("/neobdm-broker-summary/journey")
async def get_broker_journey_data(request: BrokerJourneyRequest):
    """
    Get broker journey data showing accumulation/distribution over time.
    
    Request Body:
        {
            "ticker": "ANTM",
            "brokers": ["YP", "RH", "OP"],
            "start_date": "2026-01-01",
            "end_date": "2026-01-13"
        }
    
    Returns:
        Broker journey data with daily breakdown and cumulative tracking
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    
    try:
        if not request.brokers:
            return JSONResponse(
                status_code=400,
                content={"error": "At least one broker must be specified"}
            )
        
        journey_data = db_manager.get_broker_journey(
            request.ticker.upper(),
            request.brokers,
            request.start_date,
            request.end_date
        )
        
        return journey_data
        
    except Exception as e:
        logging.error(f"Error fetching broker journey: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.get("/neobdm-broker-summary/top-holders/{ticker}")
async def get_top_holders(
    ticker: str,
    limit: int = Query(3, ge=1, le=10)
):
    """
    Get top N holders for a ticker based on cumulative net lot.
    
    Args:
        ticker: Stock ticker symbol
        limit: Number of top holders to return (default 3, max 10)
    
    Returns:
        {
            "ticker": "ANTM",
            "top_holders": [
                {
                    "broker_code": "YP",
                    "total_net_lot": 150000,
                    "total_net_value": 1250.5,
                    "trade_count": 15,
                    "first_date": "2026-01-01",
                    "last_date": "2026-01-13"
                },
                ...
            ]
        }
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    
    try:
        top_holders = db_manager.get_top_holders_by_net_lot(ticker.upper(), limit)
        return {
            "ticker": ticker.upper(),
            "top_holders": top_holders
        }
    except Exception as e:
        logging.error(f"Error fetching top holders for {ticker}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.get("/neobdm-dates")
def get_neobdm_dates():
    """Get list of available scrape dates in database."""
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    dates = db_manager.get_available_neobdm_dates()
    return {"dates": dates}


@router.post("/neobdm-batch-scrape")
async def run_neobdm_batch_scrape(background_tasks: BackgroundTasks):
    """
    Full synchronization of all NeoBDM data (Background Task).
    """
    background_tasks.add_task(perform_full_sync)
    return {
        "status": "processing",
        "message": "Full synchronization started in the background. This will take a few minutes."
    }


async def perform_full_sync():
    """Core logic for background sync with ISOLATED sessions per task.
    
    Each method+period combination gets a fresh browser session to avoid
    state pollution and ensure reliable scraping, especially for cumulative data.
    """
    try:
        from modules.scraper_neobdm import NeoBDMScraper
        from modules.database import DatabaseManager
        import traceback
        
        methods = [('m', 'Market Maker'), ('nr', 'Non-Retail'), ('f', 'Foreign Flow')]
        periods = [('d', 'Daily'), ('c', 'Cumulative')]
        
        db_manager = DatabaseManager()
        start_time = datetime.now()
        today_str = start_time.strftime('%Y-%m-%d')
        execution_log = []
        
        print(f"[*] Starting background Full Sync at {start_time}")
        print(f"[*] Using ISOLATED SESSION approach (6 separate logins)")
        
        # Loop through all combinations with ISOLATED sessions
        for m_code, m_label in methods:
            for p_code, p_label in periods:
                log_prefix = f"[{m_label}/{p_label}]"
                print(f"\n{log_prefix} Starting isolated scraping session...")
                
                # ISOLATED SESSION: Create fresh scraper for THIS task only
                scraper = NeoBDMScraper()
                
                try:
                    # Initialize browser
                    print(f"{log_prefix} Initializing browser...", flush=True)
                    await scraper.init_browser(headless=True)
                    
                    # Login
                    print(f"{log_prefix} Logging in...", flush=True)
                    login_success = await scraper.login()
                    
                    if not login_success:
                        msg = "Login failed"
                        print(f"{log_prefix} Result: {msg}")
                        execution_log.append(f"{log_prefix}: {msg}")
                        continue  # Skip to next task

                    # Cleanup old data for today
                    try:
                        conn = db_manager._get_conn()
                        conn.execute(
                            "DELETE FROM neobdm_records WHERE method=? AND period=? AND scraped_at LIKE ?", 
                            (m_code, p_code, f"{today_str}%")
                        )
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        print(f"{log_prefix} Cleanup warning: {e}")

                    # Scrape
                    print(f"{log_prefix} Scraping data...", flush=True)
                    try:
                        df, reference_date = await scraper.get_market_summary(method=m_code, period=p_code)
                        
                        if df is not None and not df.empty:
                            data_list = df.to_dict(orient="records")
                            scraped_at = reference_date if reference_date else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            db_manager.save_neobdm_record_batch(m_code, p_code, data_list, scraped_at=scraped_at)
                            msg = f"Success ({len(df)} rows)"
                        else:
                            msg = "No data found"
                    except Exception as e:
                        print(f"{log_prefix} Scraping error: {traceback.format_exc()}")
                        msg = f"Error: {str(e)}"
                    
                    print(f"{log_prefix} Result: {msg}")
                    execution_log.append(f"{log_prefix}: {msg}")
                    
                except Exception as e:
                    msg = f"Session error: {str(e)}"
                    print(f"{log_prefix} {msg}")
                    execution_log.append(f"{log_prefix}: {msg}")
                    
                finally:
                    # CRITICAL: Close browser immediately after each task
                    print(f"{log_prefix} Closing browser session...", flush=True)
                    await scraper.close()
                
                # Small cooldown between tasks
                await asyncio.sleep(2)
            
        duration = datetime.now() - start_time
        print(f"\n[*] Background Full Sync completed in {duration.total_seconds():.2f}s.")
        print(f"[*] Logs: {execution_log}")


    except Exception as e:
        print(f"[!] Critical error in background sync: {e}")
        import logging
        logging.error(f"Critical error in background sync: {e}")


@router.get("/neobdm-history")
@router.get("/neobdm/history") # Al ias to fix potential 404s from slash/dash mismatch
def get_neobdm_history(
    symbol: str = None,
    ticker: str = None,
    method: str = "m",
    period: str = "c",
    limit: int = 30
):
    """
    Get historical money flow data for a ticker.
    
    Args:
        symbol: Stock symbol (primary)
        ticker: Alternative name for symbol (compatibility)
        method: Analysis method
        period: Time period
        limit: Number of days to return
    """
    from modules.database import DatabaseManager
    from data_provider import data_provider
    
    # Use symbol or fallback to ticker
    stock_symbol = symbol or ticker
    
    if not stock_symbol:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing required parameter: symbol or ticker"}
        )
    
    try:
        db_manager = DatabaseManager()
        history_data = db_manager.get_neobdm_history(stock_symbol.upper(), method, period, limit)
        
        # NEW: Enrich dengan market cap dan flow impact
        market_cap = data_provider.get_market_cap(stock_symbol)
        
        if market_cap:
            for record in history_data:
                # Add market cap to each record
                record['market_cap'] = market_cap
                
                # Calculate flow impact if we have flow data
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
        
        # Return with backward-compatible structure
        return {
            "symbol": stock_symbol.upper(),
            "history": history_data
        }
    
    except Exception as e:
        logging.error(f"Error fetching NeoBDM history: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.get("/neobdm-tickers")
async def get_neobdm_tickers():
    """Get list of all tickers available in NeoBDM data."""
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    try:
        tickers = db_manager.get_neobdm_tickers()
        return {"tickers": tickers}
    except Exception as e:
        logging.error(f"NeoBDM Tickers error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/neobdm-hot")
async def get_neobdm_hot():
    """Get hot signals - stocks with interesting flow patterns."""
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    try:
        hot_list = db_manager.get_latest_hot_signals()
        return {"signals": hot_list}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/broker-summary")
async def get_broker_summary_api(
    ticker: str,
    trade_date: str,
    scrape: bool = Query(False)
):
    """
    Get broker summary data (Net Buy & Net Sell).
    If data is not in DB or scrape=True, trigger the scraper.
    """
    from modules.database import DatabaseManager
    from modules.scraper_neobdm import NeoBDMScraper
    
    db_manager = DatabaseManager()
    
    # 1. Try to fetch from DB first (unless forced scrape)
    if not scrape:
        data = db_manager.get_broker_summary(ticker.upper(), trade_date)
        if data['buy'] or data['sell']:
            print(f"[*] Found broker summary for {ticker} on {trade_date} in DB.")
            return {
                "ticker": ticker.upper(),
                "trade_date": trade_date,
                "buy": data['buy'],
                "sell": data['sell'],
                "source": "database"
            }
            
    # 2. Trigger scraper if needed
    print(f"[*] Scraping broker summary for {ticker} on {trade_date}...")
    scraper = NeoBDMScraper()
    try:
        await scraper.init_browser(headless=True)
        login_success = await scraper.login()
        if not login_success:
            return JSONResponse(
                status_code=401,
                content={"error": "Failed to login to NeoBDM"}
            )
            
        scraped_data = await scraper.get_broker_summary(ticker.upper(), trade_date)
        
        if scraped_data and (scraped_data['buy'] or scraped_data['sell']):
            # Save to DB, then return normalized DB output
            db_manager.save_broker_summary_batch(
                ticker=ticker,
                trade_date=trade_date,
                buy_data=scraped_data['buy'],
                sell_data=scraped_data['sell']
            )

            data = db_manager.get_broker_summary(ticker.upper(), trade_date)
            return {
                "ticker": ticker.upper(),
                "trade_date": trade_date,
                "buy": data['buy'],
                "sell": data['sell'],
                "source": "scraper"
            }
        else:
            return JSONResponse(
                status_code=404,
                content={"error": f"No data found for {ticker} on {trade_date}"}
            )
            
    except Exception as e:
        logging.error(f"Broker Summary API error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
    finally:
        await scraper.close()


@router.post("/neobdm-broker-summary-batch")
async def run_neobdm_broker_summary_batch(
    background_tasks: BackgroundTasks,
    tasks: List[BrokerSummaryBatchTask] = Body(...)
):
    """
    Trigger a batch scraping job for multiple tickers and dates.
    Format: [{"ticker": "ANTM", "dates": ["2026-01-12", "2026-01-11"]}, ...]
    """
    if not tasks:
        return JSONResponse(status_code=400, content={"error": "No batch tasks provided"})

    tasks_payload = [task.dict() for task in tasks]
    background_tasks.add_task(perform_broker_summary_batch_sync, tasks_payload)
    return {
        "status": "processing",
        "message": f"Scrape job started for {len(tasks)} tickers. Data will be available in the database shortly."
    }


async def perform_broker_summary_batch_sync(tasks: list):
    """Background task for batch broker summary sync."""
    from modules.scraper_neobdm import NeoBDMScraper
    from modules.database import DatabaseManager
    import logging
    
    db_manager = DatabaseManager()
    scraper = NeoBDMScraper()
    
    try:
        await scraper.init_browser(headless=True)
        results = await scraper.get_broker_summary_batch(tasks)
        success_count = 0
        error_count = 0
        for res in results:
            if "error" not in res:
                db_manager.save_broker_summary_batch(
                    ticker=res['ticker'],
                    trade_date=res['trade_date'],
                    buy_data=res['buy'],
                    sell_data=res['sell']
                )
                success_count += 1
            else:
                error_count += 1
                logging.warning(f"[!] Batch Broker Summary error for {res.get('ticker')} on {res.get('trade_date')}: {res.get('error')}")
        
        print(f"[*] Batch Broker Summary Sync completed. {success_count} saved, {error_count} errors.")
        
    except Exception as e:
        logging.error(f"Error in background batch broker summary sync: {e}")
    finally:
        await scraper.close()


@router.get("/volume-daily")
async def get_volume_daily(ticker: str):
    """
    Get daily volume data for a ticker with smart incremental fetching.
    
    Args:
        ticker: Stock ticker (e.g., 'BBCA')
    
    Returns:
        {
            "ticker": "BBCA",
            "data": [
                {
                    "trade_date": "2025-12-22",
                    "volume": 12500000,
                    "close_price": 8750,
                    ...
                }
            ],
            "source": "database" | "fetched_full" | "fetched_incremental",
            "records_added": 10
        }
    """
    from modules.database import DatabaseManager
    
    try:
        db_manager = DatabaseManager()
        result = db_manager.get_or_fetch_volume(ticker.upper())
        
        return result
        
    except Exception as e:
        logging.error(f"Error fetching volume data for {ticker}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
