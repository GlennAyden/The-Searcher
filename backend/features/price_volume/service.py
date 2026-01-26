"""
Price Volume Service Layer.

Orchestrates repository calls with analysis modules.
"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta

from .hk_analyzer import HKAnalyzer
from shared.utils.technical import calculate_moving_averages


class PriceVolumeService:
    """Service layer for Price Volume operations."""
    
    def __init__(self):
        # Import repository lazily to avoid circular imports
        from db.price_volume_repository import price_volume_repo
        self.repository = price_volume_repo
        self.hk_analyzer = HKAnalyzer()
    
    # ========================================================================
    # CRUD Operations (delegate to repository)
    # ========================================================================
    
    def get_ohlcv_data(self, ticker: str, start_date: str, end_date: str) -> List[Dict]:
        return self.repository.get_ohlcv_data(ticker, start_date, end_date)
    
    def upsert_ohlcv_data(self, ticker: str, records: List[Dict]) -> int:
        return self.repository.upsert_ohlcv_data(ticker, records)
    
    def get_latest_date(self, ticker: str) -> Optional[str]:
        return self.repository.get_latest_date(ticker)
    
    def get_earliest_date(self, ticker: str) -> Optional[str]:
        return self.repository.get_earliest_date(ticker)
    
    def get_all_tickers(self) -> List[str]:
        return self.repository.get_all_tickers()
    
    # ========================================================================
    # Scanner Operations
    # ========================================================================
    
    def detect_unusual_volumes(
        self,
        scan_days: int = 30,
        lookback_days: int = 20,
        min_ratio: float = 2.0
    ) -> List[Dict]:
        """Detect unusual volume events across all tickers."""
        return self.repository.detect_unusual_volumes(
            scan_days=scan_days,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
    
    def scan_with_scoring(
        self,
        scan_days: int = 30,
        lookback_days: int = 20,
        min_ratio: float = 2.0,
        min_score: int = 40
    ) -> List[Dict]:
        """Scan for anomalies with composite scoring."""
        return self.repository.scan_with_scoring(
            scan_days=scan_days,
            lookback_days=lookback_days,
            min_ratio=min_ratio,
            min_score=min_score
        )
    
    def get_volume_spike_markers(
        self,
        ticker: str,
        lookback_days: int = 20,
        min_ratio: float = 2.0
    ) -> List[Dict]:
        """Get volume spike markers for chart overlay."""
        return self.repository.get_volume_spike_markers(
            ticker=ticker,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
    
    # ========================================================================
    # Analysis Operations
    # ========================================================================
    
    def get_sideways_compression(self, ticker: str, days: int = 15) -> Dict:
        """Detect sideways compression (consolidation)."""
        return self.repository.detect_sideways_compression(ticker, days)
    
    def calculate_flow_impact(self, ticker: str, date: str) -> Dict:
        """Calculate flow impact relative to market cap."""
        return self.repository.calculate_flow_impact(ticker, date)
    
    def get_hk_analysis(
        self,
        ticker: str,
        spike_date: Optional[str] = None,
        post_spike_days: int = 10
    ) -> Dict:
        """
        Get HK Methodology analysis for a ticker.
        
        Uses HKAnalyzer to perform:
        - Volume Asymmetry analysis
        - Pre-Spike Accumulation analysis
        """
        # Get OHLCV data (9 months)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=270)
        
        records = self.repository.get_ohlcv_data(
            ticker,
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        if not records or len(records) < 30:
            return {
                "ticker": ticker.upper(),
                "error": "Insufficient data. Need at least 30 days of OHLCV data."
            }
        
        # Get spike markers for auto-detection
        spike_markers = None
        if not spike_date:
            spike_markers = self.repository.get_volume_spike_markers(
                ticker, lookback_days=20, min_ratio=2.0
            )
        
        # Run HK analysis
        result = self.hk_analyzer.analyze(
            records=records,
            spike_date=spike_date,
            post_spike_days=post_spike_days,
            spike_markers=spike_markers
        )
        
        return {
            "ticker": ticker.upper(),
            **result
        }
    
    # ========================================================================
    # Moving Averages
    # ========================================================================
    
    def get_moving_averages(
        self,
        data: List[Dict],
        periods: List[int] = [5, 10, 20]
    ) -> Dict:
        """Calculate moving averages for OHLCV data."""
        return calculate_moving_averages(data, periods)


# Singleton instance for convenience
price_volume_service = PriceVolumeService()
