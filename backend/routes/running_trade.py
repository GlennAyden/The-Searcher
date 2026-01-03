"""Running Trade routes for real-time trade monitoring and analysis."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional
import logging
import json

# Global state for running trade client
running_trade_client: Optional['StockbitClient'] = None
running_trade_analyzer = None
last_snapshot_time = None

# Will be initialized when first imported
def init_globals():
    """Initialize global state for running trade."""
    global running_trade_analyzer, last_snapshot_time
    from accum_dist import TradeAnalyzer
    running_trade_analyzer = TradeAnalyzer()
    last_snapshot_time = datetime.now()

router = APIRouter(prefix="/api/rt", tags=["running_trade"])


@router.get("/tickers")
async def get_rt_ticker_universe():
    """Get list of available tickers for running trade monitoring."""
    from config import TICKER_DB_FILE
    try:
        with open(TICKER_DB_FILE, 'r') as f:
            data = json.load(f)
            return {"tickers": sorted(list(data.keys()))}
    except Exception as e:
        return {"tickers": ["BBCA", "BBRI", "BMRI", "TLKM", "ASII", "GOTO"]}  # Fallback


@router.post("/start")
async def start_rt_stream(headless: bool = False):
    """Start running trade stream client."""
    global running_trade_client
    if running_trade_client:
        return {"status": "already_running", "message": "Stream client is already active."}
    
    try:
        from stockbit_client import StockbitClient
        running_trade_client = StockbitClient(headless=headless)
        await running_trade_client.initialize()
        return {"status": "success", "message": "Stream client started."}
    except Exception as e:
        running_trade_client = None
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/login")
async def start_login_mode():
    """Start browser in headful mode for manual login."""
    global running_trade_client
    if running_trade_client:
        await running_trade_client.close()
        running_trade_client = None
    
    try:
        from stockbit_client import StockbitClient
        running_trade_client = StockbitClient(headless=False)
        await running_trade_client.initialize()
        return {"status": "success", "message": "Login window opened. Please login and click Save Session."}
    except Exception as e:
        running_trade_client = None
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/save-session")
async def save_session():
    """Save browser session cookies for future headless runs."""
    global running_trade_client
    if not running_trade_client:
        return JSONResponse(status_code=400, content={"error": "Client not started."})
    
    try:
        await running_trade_client.save_session()
        return {"status": "success", "message": "Session saved successfully."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/stop")
async def stop_rt_stream():
    """Stop running trade stream client."""
    global running_trade_client
    if running_trade_client:
        await running_trade_client.close()
        running_trade_client = None
        return {"status": "success", "message": "Stream client stopped."}
    return {"status": "not_running", "message": "No active client."}


@router.post("/reset")
async def reset_rt_stats():
    """Reset trade analyzer statistics."""
    running_trade_analyzer.reset()
    return {"status": "success", "message": "Stats reset."}


@router.get("/history")
async def get_rt_history(ticker: str):
    """Get historical running trade snapshots for a ticker."""
    from data_provider import data_provider
    df = data_provider.db_manager.get_rt_history(ticker.upper())
    if df.empty:
        return []
    return df.to_dict(orient="records")


@router.get("/stream")
async def get_rt_stream(tickers: str = "BBCA"):
    """
    Get live running trade stream for specified tickers.
    
    Args:
        tickers: Comma-separated list of ticker symbols
    """
    global running_trade_client, last_snapshot_time
    from data_provider import data_provider
    from stockbit_client import StockbitClient
    
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        return JSONResponse(status_code=400, content={"error": "No tickers provided"})

    if not running_trade_client:
        try:
            running_trade_client = StockbitClient(headless=False)
            await running_trade_client.initialize()
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed to auto-start: {str(e)}"})

    try:
        resp = await running_trade_client.get_running_trade(ticker_list)
        
        if "error" in resp:
            return JSONResponse(status_code=502, content=resp)
            
        trades_all = resp.get(" data", {}).get("running_trade", [])
        
        # Group trades by ticker
        trades_by_ticker = {t: [] for t in ticker_list}
        for trade in trades_all:
            symbol = trade.get("symbol")
            if symbol in trades_by_ticker:
                trades_by_ticker[symbol].append(trade)
        
        # Process each ticker
        results = {}
        for ticker in ticker_list:
            stats = running_trade_analyzer.process_trades(ticker, trades_by_ticker[ticker])
            results[ticker] = stats
            
        # Snapshot Logic (Every 15 minutes)
        now = datetime.now()
        if now - last_snapshot_time >= timedelta(minutes=15):
            for ticker in ticker_list:
                snapshot = running_trade_analyzer.get_interval_snapshot(ticker)
                if snapshot:
                    snapshot['interval_start'] = last_snapshot_time.strftime('%Y-%m-%d %H:%M:%S')
                    snapshot['interval_end'] = now.strftime('%Y-%m-%d %H:%M:%S')
                    data_provider.db_manager.save_rt_snapshot(snapshot)
                    running_trade_analyzer.reset_interval(ticker)
            last_snapshot_time = now
            
        return results
    except Exception as e:
        import traceback
        logging.error(f"Stream Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/debug-sample")
async def debug_sample_rt():
    """Debug endpoint to test running trade API."""
    try:
        from stockbit_client import StockbitClient
        client = StockbitClient(headless=True)
        try:
            data = await client.get_running_trade(["BBCA"])
            return data
        finally:
            await client.close()
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}


@router.post("/scrape-history")
async def scrape_rt_history(ticker: str, date: str):
    """Scrape full day historical running trade data."""
    global running_trade_client
    from data_provider import data_provider
    from stockbit_client import StockbitClient
    
    if not running_trade_client:
        try:
            running_trade_client = StockbitClient(headless=True)
            await running_trade_client.initialize()
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed to start client: {str(e)}"})
    
    try:
        resp = await running_trade_client.get_running_trade_history_full(ticker=ticker, date=date)
        if "error" in resp:
            return JSONResponse(status_code=502, content=resp)
        
        trades = resp.get("trades", [])
        data_provider.db_manager.save_raw_trades(ticker, date, trades)
        
        return {"status": "success", "count": len(trades), "message": f"Scraped and saved {len(trades)} trades."}
    except Exception as e:
        import traceback
        logging.error(f"Scrape History Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/analysis")
async def get_rt_analysis(ticker: str, dates: str):
    """Get raw trade analysis for specified dates."""
    try:
        from data_provider import data_provider
        date_list = dates.split(',')
        all_trades = []
        for date in date_list:
            df = data_provider.db_manager.get_raw_trades(ticker, date.strip())
            if not df.empty:
                all_trades.extend(df.to_dict(orient="records"))
        return all_trades
    except Exception as e:
        import traceback
        logging.error(f"Analysis Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/inventory")
async def get_rt_inventory():
    """Get inventory of all scraped historical data."""
    try:
        from data_provider import data_provider
        df = data_provider.db_manager.get_raw_history_inventory()
        if df.empty:
            return []
        return df.to_dict(orient="records")
    except Exception as e:
        import traceback
        logging.error(f"Inventory Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/analysis/delete")
async def delete_rt_analysis(ticker: str, date: str):
    """Delete historical trade data for a specific date."""
    try:
        from data_provider import data_provider
        success = data_provider.db_manager.delete_raw_trades(ticker, date)
        if success:
            return {"status": "success", "message": f"Deleted trades for {ticker} on {date}"}
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to delete from database"})
    except Exception as e:
        import traceback
        logging.error(f"Delete Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Initialize globals when module is imported
init_globals()
