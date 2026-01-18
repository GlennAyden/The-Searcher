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
    """Parse and save pasted trade data."""
    try:
        # Parse the TSV data
        records = parse_tsv_data(request.data)
        
        if not records:
            raise HTTPException(status_code=400, detail="No valid records found in data")
        
        # Save to database
        saved_count = repo.save_records(request.ticker, request.trade_date, records)
        
        return {
            "success": True,
            "ticker": request.ticker.upper(),
            "trade_date": request.trade_date,
            "records_saved": saved_count
        }
    except Exception as e:
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
    """Delete records for ticker and date."""
    success = repo.delete_records(ticker, trade_date)
    
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
