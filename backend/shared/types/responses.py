"""
API Response Types

Standard response models for API endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Generic, TypeVar, Any
from datetime import datetime

T = TypeVar('T')


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error info")
    status_code: int = Field(default=500)
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": "Failed to fetch data",
                "detail": "Connection timeout",
                "status_code": 500
            }
        }


class APIResponse(BaseModel):
    """Generic API response wrapper."""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class PaginatedResponse(BaseModel):
    """Paginated response for list endpoints."""
    items: List[Any] = Field(default_factory=list)
    total: int = Field(default=0, description="Total items available")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=20, description="Items per page")
    has_more: bool = Field(default=False, description="Whether more pages exist")
    
    @property
    def total_pages(self) -> int:
        if self.page_size <= 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size


# ========================================================================
# Feature-specific Response Models
# ========================================================================

class PriceVolumeResponse(BaseModel):
    """Response for /api/price-volume/{ticker}."""
    ticker: str
    data: List[dict] = Field(default_factory=list, description="OHLCV records")
    ma5: List[dict] = Field(default_factory=list)
    ma10: List[dict] = Field(default_factory=list)
    ma20: List[dict] = Field(default_factory=list)
    volumeMa20: List[dict] = Field(default_factory=list)
    source: str = Field(default="database", description="database|fetched_full|fetched_incremental")
    records_count: int = 0
    records_added: int = 0


class BrokerSummaryResponse(BaseModel):
    """Response for broker summary endpoints."""
    ticker: str
    trade_date: str
    buy: List[dict] = Field(default_factory=list, description="Net buyers")
    sell: List[dict] = Field(default_factory=list, description="Net sellers")
    source: str = Field(default="database")


class NeoBDMSummaryResponse(BaseModel):
    """Response for /api/neobdm-summary."""
    scraped_at: Optional[str] = None
    data: List[dict] = Field(default_factory=list)


class ScanResult(BaseModel):
    """Generic scan result for anomaly/signal detection."""
    total_scanned: int = 0
    matches_found: int = 0
    results: List[dict] = Field(default_factory=list)
    scan_params: dict = Field(default_factory=dict)
    stats: Optional[dict] = None


class AlphaHunterScanResponse(BaseModel):
    """Response for Alpha Hunter stage 1 scan."""
    total_signals: int = 0
    filtered_count: int = 0
    total_matches: int = 0
    signals: List[dict] = Field(default_factory=list)
    stats: dict = Field(default_factory=dict)
    filters_applied: dict = Field(default_factory=dict)
