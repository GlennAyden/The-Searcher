"""NeoBDM routes for market maker/non-retail/foreign flow analysis."""
from fastapi import APIRouter, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Optional
import logging
import asyncio
import json

router = APIRouter(prefix="/api", tags=["neobdm"])


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
@router.get("/neobdm/history") # Alias to fix potential 404s from slash/dash mismatch
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
