"""Done Detail routes for paste-based trade data analysis."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import re

from db import DoneDetailRepository

router = APIRouter(prefix="/api/done-detail", tags=["done_detail"])
repo = DoneDetailRepository()


class PasteDataRequest(BaseModel):
    """Request body for pasting trade data."""
    ticker: str
    trade_date: str
    data: str


def parse_tsv_data(raw_data: str) -> list:
    """
    Parse TSV data from clipboard paste.
    
    Expected format:
    Time    Stock   Brd   Price   Qty   BT   BC   SC   ST
    16:14:56    SUPA    RG    1,130    60    D    CP    MG    D
    """
    lines = raw_data.strip().split('\n')
    records = []
    
    # Skip header if present
    start_idx = 0
    if lines and 'Time' in lines[0] and 'Stock' in lines[0]:
        start_idx = 1
    
    for line in lines[start_idx:]:
        if not line.strip():
            continue
        
        # Split by tab
        parts = line.split('\t')
        if len(parts) < 9:
            continue
        
        try:
            # Parse price (remove commas)
            price_str = parts[3].replace(',', '').strip()
            price = float(price_str) if price_str else 0
            
            # Parse quantity (remove commas)
            qty_str = parts[4].replace(',', '').strip()
            qty = int(qty_str) if qty_str else 0
            
            record = {
                'time': parts[0].strip(),
                'board': parts[2].strip(),
                'price': price,
                'qty': qty,
                'buyer_type': parts[5].strip(),
                'buyer_code': parts[6].strip(),
                'seller_code': parts[7].strip(),
                'seller_type': parts[8].strip() if len(parts) > 8 else ''
            }
            records.append(record)
        except (ValueError, IndexError) as e:
            print(f"[!] Error parsing line: {line} - {e}")
            continue
    
    return records


@router.get("/exists/{ticker}/{trade_date}")
async def check_exists(ticker: str, trade_date: str):
    """Check if data exists for ticker and date."""
    exists = repo.check_exists(ticker, trade_date)
    return {"exists": exists, "ticker": ticker.upper(), "trade_date": trade_date}


@router.post("/save")
async def save_data(request: PasteDataRequest):
    """Parse, save pasted trade data, and generate pre-computed synthesis."""
    try:
        # Parse the TSV data
        records = parse_tsv_data(request.data)
        
        if not records:
            raise HTTPException(status_code=400, detail="No valid records found in data")
        
        # Save raw records to database
        saved_count = repo.save_records(request.ticker, request.trade_date, records)
        
        if saved_count > 0:
            # Generate synthesis (pre-compute all analysis)
            import time
            start_time = time.time()
            
            print(f"\n{'='*60}")
            print(f"🔄 SYNTHESIS PROGRESS: {request.ticker} | {request.trade_date}")
            print(f"   📊 Records to process: {saved_count:,}")
            print(f"{'='*60}")
            
            # Step 1: Imposter Analysis
            step_start = time.time()
            print(f"   [1/4] ▓░░░░░░░░░ Detecting imposter trades...", end="", flush=True)
            imposter_data = repo.detect_imposter_trades(
                request.ticker, request.trade_date, request.trade_date
            )
            imposter_time = time.time() - step_start
            imposter_count = imposter_data.get('imposter_count', 0) if imposter_data else 0
            print(f"\n   [1/4] ▓▓▓░░░░░░░ Imposter trades detected: {imposter_count:,} ({imposter_time:.1f}s)")
            
            # Step 2: Speed Analysis
            step_start = time.time()
            print(f"   [2/4] ▓▓▓░░░░░░░ Analyzing trading speed...", end="", flush=True)
            speed_data = repo.analyze_speed(
                request.ticker, request.trade_date, request.trade_date
            )
            speed_time = time.time() - step_start
            burst_count = len(speed_data.get('burst_events', [])) if speed_data else 0
            print(f"\n   [2/4] ▓▓▓▓▓▓░░░░ Speed analyzed, bursts: {burst_count} ({speed_time:.1f}s)")
            
            # Step 3: Combined Analysis
            step_start = time.time()
            print(f"   [3/4] ▓▓▓▓▓▓░░░░ Generating combined signal...", end="", flush=True)
            combined_data = repo.get_combined_analysis(
                request.ticker, request.trade_date, request.trade_date
            )
            combined_time = time.time() - step_start
            signal = combined_data.get('signal', {}).get('direction', 'NEUTRAL') if combined_data else 'N/A'
            print(f"\r   [3/4] ▓▓▓▓▓▓▓▓░░ Signal generated: {signal} ({combined_time:.1f}s)")
            
            # Step 4: Save Synthesis
            step_start = time.time()
            print(f"   [4/4] ▓▓▓▓▓▓▓▓░░ Saving synthesis to database...", end="", flush=True)
            repo.save_synthesis(
                ticker=request.ticker,
                trade_date=request.trade_date,
                imposter_data=imposter_data,
                speed_data=speed_data,
                combined_data=combined_data,
                raw_record_count=saved_count
            )
            save_time = time.time() - step_start
            print(f"\r   [4/4] ▓▓▓▓▓▓▓▓▓▓ Synthesis saved ({save_time:.1f}s)")
            
            # Mark raw data as processed (ready for cleanup after 7 days)
            repo.mark_raw_as_processed(request.ticker, request.trade_date)
            
            # Run cleanup of old processed data (7-day grace period)
            cleaned = repo.delete_old_raw_data(days=7)
            
            total_time = time.time() - start_time
            print(f"{'='*60}")
            print(f"✅ SYNTHESIS COMPLETE: {request.ticker} | {request.trade_date}")
            print(f"   ⏱️  Total time: {total_time:.1f} seconds")
            print(f"   📈 Signal: {signal}")
            if cleaned > 0:
                print(f"   🗑️  Cleaned up: {cleaned:,} old records")
            print(f"{'='*60}\n")
        
        return {
            "success": True,
            "ticker": request.ticker.upper(),
            "trade_date": request.trade_date,
            "records_saved": saved_count,
            "synthesis_generated": saved_count > 0
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/{ticker}/{trade_date}")
async def get_data(ticker: str, trade_date: str):
    """Get trade records for ticker and date."""
    df = repo.get_records(ticker, trade_date)
    
    if df.empty:
        return {"records": [], "count": 0}
    
    return {
        "records": df.to_dict(orient='records'),
        "count": len(df)
    }


@router.get("/history")
async def get_history():
    """Get all saved ticker/date combinations."""
    df = repo.get_saved_history()
    
    if df.empty:
        return {"history": []}
    
    return {"history": df.to_dict(orient='records')}


@router.delete("/{ticker}/{trade_date}")
async def delete_data(ticker: str, trade_date: str):
    """Delete records and synthesis for ticker and date."""
    success = repo.delete_records(ticker, trade_date)
    
    # Also delete synthesis
    repo.delete_synthesis(ticker, trade_date)
    
    if not success:
        raise HTTPException(status_code=404, detail="No records found to delete")
    
    return {"success": True, "ticker": ticker.upper(), "trade_date": trade_date}


@router.get("/sankey/{ticker}/{trade_date}")
async def get_sankey_data(ticker: str, trade_date: str):
    """Get Sankey diagram data for visualization."""
    data = repo.get_sankey_data(ticker, trade_date)
    return data


@router.get("/inventory/{ticker}/{trade_date}")
async def get_inventory_data(ticker: str, trade_date: str, interval: int = 1):
    """Get Daily Inventory chart data."""
    data = repo.get_inventory_data(ticker, trade_date, interval)
    return data


@router.get("/analysis/{ticker}/{trade_date}")
async def get_accum_dist_analysis(ticker: str, trade_date: str):
    """
    Analyze accumulation/distribution pattern based on broker classification.
    
    Returns status (AKUMULASI/DISTRIBUSI/NETRAL) with breakdown by broker category.
    """
    data = repo.get_accum_dist_analysis(ticker, trade_date)
    return data


@router.get("/tickers")
async def get_available_tickers():
    """Get list of tickers that have saved Done Detail data."""
    tickers = repo.get_available_tickers()
    return {"tickers": tickers}


@router.get("/dates/{ticker}")
async def get_date_range(ticker: str):
    """Get available date range for a ticker."""
    data = repo.get_date_range(ticker)
    return data


@router.get("/imposter/{ticker}")
async def get_imposter_analysis(ticker: str, start_date: str, end_date: str):
    """
    Detect suspiciously large transactions from retail brokers.
    
    OPTIMIZED: Reads from pre-computed synthesis for instant response.
    
    Args:
        ticker: Stock symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Imposter analysis with suspicious trades, broker stats, and date breakdown
    """
    # For single-day queries, read from synthesis
    if start_date == end_date:
        synthesis = repo.get_synthesis(ticker, start_date)
        if synthesis and synthesis.get("imposter_data"):
            return synthesis["imposter_data"]
        else:
            # No synthesis found
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "error": "no_synthesis",
                "message": f"No analysis data found for {ticker} on {start_date}. Please paste done detail data first.",
                "total_transactions": 0,
                "imposter_count": 0,
                "thresholds": {"p95": 0, "p99": 0, "median": 0, "mean": 0},
                "all_trades": [],
                "imposter_trades": [],
                "by_broker": [],
                "summary": {}
            }
    
    # For range, return error (no raw fallback)
    return {
        "ticker": ticker.upper(),
        "date_range": {"start": start_date, "end": end_date},
        "error": "no_synthesis",
        "message": f"No analysis data found for {ticker}. Please paste done detail data first."
    }


@router.get("/speed/{ticker}")
async def get_speed_analysis(ticker: str, start_date: str, end_date: str):
    """
    Analyze trading speed - trades per second and burst patterns.
    
    OPTIMIZED: Reads from pre-computed synthesis for instant response.
    
    Args:
        ticker: Stock symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Speed analysis with broker stats, bursts, and timeline
    """
    # For single-day queries, read from synthesis
    if start_date == end_date:
        synthesis = repo.get_synthesis(ticker, start_date)
        if synthesis and synthesis.get("speed_data"):
            return synthesis["speed_data"]
        else:
            # No synthesis found
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "error": "no_synthesis",
                "message": f"No analysis data found for {ticker} on {start_date}. Please paste done detail data first.",
                "speed_by_broker": [],
                "broker_timelines": {},
                "burst_events": [],
                "timeline": [],
                "summary": {}
            }
    
    # For range, return error (no raw fallback)
    return {
        "ticker": ticker.upper(),
        "date_range": {"start": start_date, "end": end_date},
        "error": "no_synthesis",
        "message": f"No analysis data found for {ticker}. Please paste done detail data first."
    }


@router.get("/combined/{ticker}")
async def get_combined_analysis(ticker: str, start_date: str, end_date: str):
    """
    Combined analysis merging Impostor and Speed data for trading signals.
    
    OPTIMIZED: Reads from pre-computed synthesis for instant response (< 100ms).
    Returns error with guidance if synthesis doesn't exist (user needs to paste data).
    
    Provides:
    - Signal strength indicator (bullish/bearish with confidence %)
    - Power brokers (top in both impostor and speed)
    - Impostor flow (net buy vs sell)
    - Activity timeline with burst markers
    
    Args:
        ticker: Stock symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Combined analysis with signal, power brokers, flow, and timeline
    """
    # For single-day queries, read from synthesis
    if start_date == end_date:
        synthesis = repo.get_synthesis(ticker, start_date)
        if synthesis and synthesis.get("combined_data"):
            print(f"[*] Serving combined analysis from synthesis for {ticker} on {start_date}")
            return synthesis["combined_data"]
        else:
            # No synthesis found - return helpful error
            print(f"[!] No synthesis found for {ticker} on {start_date}")
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "error": "no_synthesis",
                "message": f"No analysis data found for {ticker} on {start_date}. Please paste done detail data first.",
                "signal": {"direction": "NEUTRAL", "level": "NEUTRAL", "confidence": 0},
                "impostor_flow": {"buy_value": 0, "sell_value": 0, "net_value": 0, "buy_pct": 0, "sell_pct": 0},
                "power_brokers": [],
                "key_metrics": {},
                "timeline": [],
                "burst_events": [],
                "thresholds": {"p95": 0, "p99": 0, "median": 0, "mean": 0}
            }
    
    # For range queries, aggregate from synthesis
    synthesis_list = repo.get_synthesis_range(ticker, start_date, end_date)
    if synthesis_list:
        # Aggregate combined data from multiple days
        # For now, return the most recent day's data
        latest = synthesis_list[0]
        if latest.get("combined_data"):
            return latest["combined_data"]
    
    # No synthesis for range either
    return {
        "ticker": ticker.upper(),
        "date_range": {"start": start_date, "end": end_date},
        "error": "no_synthesis",
        "message": f"No analysis data found for {ticker} from {start_date} to {end_date}. Please paste done detail data for each date first.",
        "signal": {"direction": "NEUTRAL", "level": "NEUTRAL", "confidence": 0},
        "impostor_flow": {"buy_value": 0, "sell_value": 0, "net_value": 0, "buy_pct": 0, "sell_pct": 0},
        "power_brokers": [],
        "key_metrics": {},
        "timeline": [],
        "burst_events": [],
        "thresholds": {"p95": 0, "p99": 0, "median": 0, "mean": 0}
    }


@router.get("/broker/{ticker}/{broker_code}")
async def get_broker_profile(ticker: str, broker_code: str, start_date: str, end_date: str):
    """
    Get detailed profile for a specific broker.
    """
    data = repo.get_broker_profile(ticker, broker_code, start_date, end_date)
    return data


@router.get("/range-analysis/{ticker}")
async def get_range_analysis(ticker: str, start_date: str, end_date: str):
    """
    Range-based analysis for Done Detail with focus on:
    1. Retail Capitulation (50% Rule) - tracking when retail "dumps" their holdings
    2. Imposter Recurrence - detecting consistent ghost broker activity
    3. Battle Timeline - daily imposter activity visualization
    
    OPTIMIZED: Uses pre-computed synthesis data for instant response.
    Falls back to raw data processing if synthesis not available.
    
    Args:
        ticker: Stock symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Range analysis with capitulation, recurrence, timeline and summary
    """
    # Use synthesis-based method (much faster)
    data = repo.get_range_analysis_from_synthesis(ticker, start_date, end_date)
    return data
