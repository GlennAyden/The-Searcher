"""NeoBDM routes for market maker/non-retail/foreign flow analysis."""
from fastapi import APIRouter, Query
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
async def run_neobdm_batch_scrape():
    """
    Full synchronization of all NeoBDM data.
    
    Scrapes all combinations:
    - 3 methods: Market Maker, Non-Retail, Foreign Flow
    - 2 periods: Daily, Cumulative
    
    Total: 6 sequential scrapes with fresh browser sessions
    """
    try:
        from modules.scraper_neobdm import NeoBDMScraper
        from modules.database import DatabaseManager
        
        methods = [('m', 'Market Maker'), ('nr', 'Non-Retail'), ('f', 'Foreign Flow')]
        periods = [('d', 'Daily'), ('c', 'Cumulative')]
        
        db_manager = DatabaseManager()
        execution_log = []
        
        start_time = datetime.now()
        today_str = start_time.strftime('%Y-%m-%d')
        
        # Loop through all combinations
        for m_code, m_label in methods:
            for p_code, p_label in periods:
                log_prefix = f"[{m_label}/{p_label}]"
                print(f"{log_prefix} Starting scrape (Fresh Session)...", flush=True)
                
                # 1. Cleanup old data for today
                try:
                    conn = db_manager._get_conn()
                    conn.execute(
                        "DELETE FROM neobdm_records WHERE method=? AND period=? AND scraped_at LIKE ?", 
                        (m_code, p_code, f"{today_str}%")
                    )
                    conn.commit()
                    conn.close()
                except Exception as e:
                    print(f"{log_prefix} Cleanup warning: {e}", flush=True)

                # 2. Fresh scraper instance
                scraper = NeoBDMScraper()
                try:
                    print(f"{log_prefix} Initializing browser...", flush=True)
                    await scraper.init_browser(headless=True)
                    login_success = await scraper.login()
                    
                    if not login_success:
                        msg = "Login Failed"
                        execution_log.append(f"{log_prefix}: {msg}")
                        continue
                    
                    # Scrape
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
                        import traceback
                        print(f"{log_prefix} Error: {traceback.format_exc()}")
                        msg = f"Error: {str(e)}"
                    
                    print(f"{log_prefix} Result: {msg}", flush=True)
                    execution_log.append(f"{log_prefix}: {msg}")
                    
                except Exception as e:
                    execution_log.append(f"{log_prefix}: Critical Error {e}")
                finally:
                    await scraper.close()
                
                # 3. Cool-down
                await asyncio.sleep(5)
        
        duration = datetime.now() - start_time
        
        return {
            "status": "success",
            "message": f"Sequential sync completed in {duration.total_seconds():.2f}s.",
            "details": execution_log
        }
    except Exception as e:
        logging.error(f"NeoBDM Batch Scrape error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/neobdm-history")
async def get_neobdm_history(
    symbol: str,
    method: str = "m",
    period: str = "c",
    limit: int = 30
):
    """
    Get historical money flow data for a ticker.
    
    Args:
        symbol: Stock symbol
        method: Analysis method
        period: Time period
        limit: Number of days to return
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    try:
        history = db_manager.get_neobdm_history(symbol.upper(), method, period, limit)
        return {"symbol": symbol.upper(), "history": history}
    except Exception as e:
        logging.error(f"NeoBDM History error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


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
