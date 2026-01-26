"""
Market Data Types

Pydantic models for market-related data structures.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class OHLCVRecord(BaseModel):
    """OHLCV candlestick data record."""
    time: str = Field(..., description="Date in YYYY-MM-DD format")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Trading volume")
    
    class Config:
        json_schema_extra = {
            "example": {
                "time": "2026-01-25",
                "open": 8500.0,
                "high": 8650.0,
                "low": 8450.0,
                "close": 8600.0,
                "volume": 12500000
            }
        }


class BrokerSummaryRecord(BaseModel):
    """Broker summary buy/sell record."""
    broker_code: str = Field(..., description="Broker code (e.g., 'YP', 'RH')")
    lot: int = Field(..., description="Number of lots traded")
    value: float = Field(..., description="Total value in millions")
    avg_price: Optional[float] = Field(None, description="Average price per share")
    
    class Config:
        json_schema_extra = {
            "example": {
                "broker_code": "YP",
                "lot": 15000,
                "value": 125.5,
                "avg_price": 8367
            }
        }


class FlowData(BaseModel):
    """Money flow data for a ticker."""
    ticker: str
    flow_d0: float = Field(..., description="Today's flow in millions")
    flow_d1: Optional[float] = Field(None, description="Yesterday's flow")
    flow_w1: Optional[float] = Field(None, description="Last week's flow")
    flow_w2: Optional[float] = Field(None, description="2 weeks ago flow")
    flow_cum: Optional[float] = Field(None, description="Cumulative flow")
    price: Optional[float] = None
    change: Optional[float] = Field(None, description="Price change %")
    
    class Config:
        json_schema_extra = {
            "example": {
                "ticker": "ANTM",
                "flow_d0": 45.5,
                "flow_d1": 32.1,
                "flow_w1": 120.5,
                "flow_cum": 250.0,
                "price": 1450,
                "change": 2.5
            }
        }


class TickerInfo(BaseModel):
    """Basic ticker information."""
    ticker: str = Field(..., description="Stock ticker symbol")
    name: Optional[str] = Field(None, description="Company name")
    sector: Optional[str] = Field(None, description="Industry sector")
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    shares_outstanding: Optional[int] = Field(None, description="Shares outstanding")
    last_price: Optional[float] = None
    last_updated: Optional[datetime] = None


class VolumeSpike(BaseModel):
    """Volume spike detection result."""
    ticker: str
    date: str
    volume: int
    volume_ratio: float = Field(..., description="Volume / Avg Volume ratio")
    close: float
    change_pct: float
    signal_level: str = Field(..., description="FIRE, HOT, or WARM")
    

class HotSignal(BaseModel):
    """NeoBDM hot signal with scoring."""
    ticker: str
    price: Optional[float] = None
    change: Optional[float] = None
    flow: Optional[float] = None
    signal_score: int = Field(default=0, description="Composite signal score")
    signal_strength: str = Field(default="WEAK", description="VERY_STRONG, STRONG, MODERATE, WEAK")
    patterns: List[dict] = Field(default_factory=list)
    conviction: Optional[str] = None
    entry_zone: Optional[str] = None
