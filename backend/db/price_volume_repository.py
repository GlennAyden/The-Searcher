"""
Price Volume Repository - Database operations for OHLCV (candlestick) data.

Manages storage and retrieval of daily stock price and volume data fetched from yfinance.
Supports incremental updates to avoid re-fetching historical data.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging

from .connection import BaseRepository

logger = logging.getLogger(__name__)


class PriceVolumeRepository(BaseRepository):
    """Repository for OHLCV price and volume data."""
    
    def __init__(self, db_path: Optional[str] = None):
        super().__init__(db_path)
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Create the price_volume table if it doesn't exist."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS price_volume (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    trade_date DATE NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ticker, trade_date)
                )
            """)
            
            # Create index for faster lookups
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_price_volume_ticker_date 
                ON price_volume(ticker, trade_date)
            """)
            conn.commit()
        finally:
            conn.close()
    
    def get_ohlcv_data(
        self, 
        ticker: str, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get OHLCV data for a ticker within a date range.
        
        Args:
            ticker: Stock ticker symbol (e.g., 'BBCA')
            start_date: Start date (YYYY-MM-DD), defaults to 9 months ago
            end_date: End date (YYYY-MM-DD), defaults to today
            
        Returns:
            List of OHLCV records sorted by date ascending
        """
        if not start_date:
            start_date = (datetime.now() - timedelta(days=270)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT trade_date, open, high, low, close, volume
                FROM price_volume
                WHERE ticker = ? AND trade_date BETWEEN ? AND ?
                ORDER BY trade_date ASC
            """, (ticker.upper(), start_date, end_date))
            
            rows = cursor.fetchall()
            return [
                {
                    'time': row[0],
                    'open': row[1],
                    'high': row[2],
                    'low': row[3],
                    'close': row[4],
                    'volume': row[5]
                }
                for row in rows
            ]
        finally:
            conn.close()
    
    def get_latest_date(self, ticker: str) -> Optional[str]:
        """
        Get the most recent trade date for a ticker in the database.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Date string (YYYY-MM-DD) or None if no data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MAX(trade_date) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        finally:
            conn.close()
    
    def get_earliest_date(self, ticker: str) -> Optional[str]:
        """
        Get the earliest trade date for a ticker in the database.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Date string (YYYY-MM-DD) or None if no data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MIN(trade_date) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        finally:
            conn.close()
    
    def upsert_ohlcv_data(self, ticker: str, data: List[Dict[str, Any]]) -> int:
        """
        Insert or update OHLCV data for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            data: List of OHLCV records with keys: time, open, high, low, close, volume
            
        Returns:
            Number of rows affected
        """
        if not data:
            return 0
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            rows_affected = 0
            
            for record in data:
                try:
                    cursor.execute("""
                        INSERT OR REPLACE INTO price_volume 
                        (ticker, trade_date, open, high, low, close, volume)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ticker.upper(),
                        record['time'],
                        record['open'],
                        record['high'],
                        record['low'],
                        record['close'],
                        record['volume']
                    ))
                    rows_affected += cursor.rowcount
                except Exception as e:
                    logger.error(f"Error inserting record for {ticker}: {e}")
            
            conn.commit()
            return rows_affected
        finally:
            conn.close()
    
    def has_data_for_ticker(self, ticker: str) -> bool:
        """
        Check if any data exists for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            True if data exists, False otherwise
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] > 0 if result else False
        finally:
            conn.close()
    
    def get_record_count(self, ticker: str) -> int:
        """
        Get the number of records for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Number of records
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            conn.close()
    
    def get_all_tickers(self) -> List[str]:
        """
        Get all unique tickers that have OHLCV data in the database.
        
        Returns:
            List of ticker symbols
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT ticker FROM price_volume ORDER BY ticker
            """)
            rows = cursor.fetchall()
            return [row[0] for row in rows]
        finally:
            conn.close()
    
    def get_volume_history(
        self, 
        ticker: str, 
        end_date: str,
        days: int = 21
    ) -> List[Dict[str, Any]]:
        """
        Get volume history for a ticker ending at a specific date.
        
        Args:
            ticker: Stock ticker symbol
            end_date: End date (YYYY-MM-DD)
            days: Number of days of history to fetch
            
        Returns:
            List of {date, volume, close} records sorted by date descending
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT trade_date, volume, close
                FROM price_volume
                WHERE ticker = ? AND trade_date <= ?
                ORDER BY trade_date DESC
                LIMIT ?
            """, (ticker.upper(), end_date, days))
            
            rows = cursor.fetchall()
            return [
                {
                    'date': row[0],
                    'volume': row[1],
                    'close': row[2]
                }
                for row in rows
            ]
        finally:
            conn.close()
    
    def detect_unusual_volumes(
        self, 
        scan_days: int = 30,
        lookback_days: int = 20,
        min_ratio: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Detect unusual volume events across all tickers.
        
        Uses Median of lookback_days as baseline. Unusual = volume > min_ratio * median.
        
        Args:
            scan_days: Number of recent days to scan for unusual volumes
            lookback_days: Number of days to calculate median baseline
            min_ratio: Minimum volume/median ratio to be considered unusual
            
        Returns:
            List of unusual volume events sorted by ratio descending
        """
        import statistics
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d')
        
        unusual_volumes = []
        tickers = self.get_all_tickers()
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            for ticker in tickers:
                # Get all data for this ticker in scan period
                cursor.execute("""
                    SELECT trade_date, volume, close, open
                    FROM price_volume
                    WHERE ticker = ? AND trade_date BETWEEN ? AND ?
                    ORDER BY trade_date DESC
                """, (ticker, start_date, end_date))
                
                scan_data = cursor.fetchall()
                
                for i, (trade_date, volume, close, open_price) in enumerate(scan_data):
                    # Get previous N days for median calculation
                    cursor.execute("""
                        SELECT volume
                        FROM price_volume
                        WHERE ticker = ? AND trade_date < ?
                        ORDER BY trade_date DESC
                        LIMIT ?
                    """, (ticker, trade_date, lookback_days))
                    
                    prev_volumes = [row[0] for row in cursor.fetchall()]
                    
                    if len(prev_volumes) < 10:  # Need minimum data for reliable median
                        continue
                    
                    median_volume = statistics.median(prev_volumes)
                    
                    if median_volume > 0:
                        ratio = volume / median_volume
                        
                        if ratio >= min_ratio:
                            # Determine category
                            if ratio >= 5:
                                category = 'extreme'
                            elif ratio >= 3:
                                category = 'high'
                            else:
                                category = 'elevated'
                            
                            # Calculate price change
                            price_change = ((close - open_price) / open_price * 100) if open_price > 0 else 0
                            
                            unusual_volumes.append({
                                'ticker': ticker,
                                'date': trade_date,
                                'volume': volume,
                                'median_20d': round(median_volume),
                                'ratio': round(ratio, 2),
                                'category': category,
                                'close': close,
                                'price_change': round(price_change, 2)
                            })
            
            # Sort by ratio descending
            unusual_volumes.sort(key=lambda x: x['ratio'], reverse=True)
            
            return unusual_volumes
            
        finally:
            conn.close()
    
    def get_volume_spike_markers(
        self,
        ticker: str,
        lookback_days: int = 20,
        min_ratio: float = 3.0,
        min_price_change: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        Get volume spike markers for a specific ticker to display on chart.
        Only shows SIGNIFICANT spikes (high volume + notable price movement).
        
        Args:
            ticker: Stock ticker symbol
            lookback_days: Number of days for median calculation
            min_ratio: Minimum volume/median ratio (default 3x for cleaner chart)
            min_price_change: Minimum absolute price change % (default 5%)
            
        Returns:
            List of spike markers with date, volume, ratio, and category
        """
        import statistics
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            # Get all data for this ticker, ordered by date
            cursor.execute("""
                SELECT trade_date, volume, close, open
                FROM price_volume
                WHERE ticker = ?
                ORDER BY trade_date ASC
            """, (ticker.upper(),))
            
            rows = cursor.fetchall()
            
            if len(rows) < lookback_days + 1:
                return []  # Not enough data
            
            spike_markers = []
            
            # For each day (starting after lookback period), check for spikes
            for i in range(lookback_days, len(rows)):
                trade_date = rows[i][0]
                volume = rows[i][1]
                close = rows[i][2]
                open_price = rows[i][3]
                
                # Calculate median of previous N days
                prev_volumes = [rows[j][1] for j in range(i - lookback_days, i)]
                
                if len(prev_volumes) < 10:
                    continue
                
                median_volume = statistics.median(prev_volumes)
                
                if median_volume > 0:
                    ratio = volume / median_volume
                    
                    # Calculate price change
                    price_change = ((close - open_price) / open_price * 100) if open_price > 0 else 0
                    
                    # Filter: Must have BOTH significant volume AND price movement
                    if ratio >= min_ratio and abs(price_change) >= min_price_change:
                        # Determine category based on ratio
                        if ratio >= 8:
                            category = 'extreme'
                            color = '#ef4444'  # red
                        elif ratio >= 5:
                            category = 'high'
                            color = '#f59e0b'  # amber
                        else:
                            category = 'elevated'
                            color = '#22c55e'  # green
                        
                        spike_markers.append({
                            'time': trade_date,
                            'volume': volume,
                            'median_20d': round(median_volume),
                            'ratio': round(ratio, 2),
                            'category': category,
                            'color': color,
                            'close': close,
                            'price_change': round(price_change, 2),
                            'position': 'aboveBar' if price_change >= 0 else 'belowBar',
                            'shape': 'arrowUp' if price_change >= 0 else 'arrowDown',
                            'text': f'{ratio:.1f}x'
                        })
            
            return spike_markers
            
        finally:
            conn.close()
    
    def detect_sideways_compression(
        self, 
        ticker: str, 
        days: int = 15
    ) -> Dict[str, Any]:
        """
        Detect if a ticker has been in sideways compression (low volatility).
        
        This is a key indicator for "Tukang Parkir" strategy - looking for stocks
        that have been consolidating before potential breakout.
        
        Uses Coefficient of Variation (CV) = std_dev / mean as volatility measure.
        
        Args:
            ticker: Stock ticker symbol
            days: Number of recent days to analyze (default 15)
            
        Returns:
            {
                "is_sideways": bool,
                "compression_score": int (0-30),
                "sideways_days": int,
                "volatility_pct": float,
                "price_range_pct": float,
                "avg_close": float
            }
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            # Get recent OHLCV data
            cursor.execute("""
                SELECT trade_date, high, low, close
                FROM price_volume
                WHERE ticker = ?
                ORDER BY trade_date DESC
                LIMIT ?
            """, (ticker.upper(), days + 5))  # Extra buffer
            
            rows = cursor.fetchall()
            
            if len(rows) < days:
                return {
                    "is_sideways": False,
                    "compression_score": 0,
                    "sideways_days": 0,
                    "volatility_pct": 999.0,
                    "price_range_pct": 999.0,
                    "avg_close": 0
                }
            
            # Use most recent 'days' records
            rows = rows[:days]
            
            closes = [row[3] for row in rows]
            highs = [row[1] for row in rows]
            lows = [row[2] for row in rows]
            
            # Calculate Coefficient of Variation (CV)
            import statistics
            mean_close = statistics.mean(closes)
            std_close = statistics.stdev(closes) if len(closes) > 1 else 0
            cv = (std_close / mean_close * 100) if mean_close > 0 else 999.0
            
            # Calculate price range percentage
            overall_high = max(highs)
            overall_low = min(lows)
            price_range_pct = ((overall_high - overall_low) / mean_close * 100) if mean_close > 0 else 999.0
            
            # Determine compression score based on CV
            if cv < 2.0:  # Very tight compression (<2% variability)
                score = 30
                sideways_days = days
                is_sideways = True
            elif cv < 3.0:  # Tight compression (<3%)
                score = 25
                sideways_days = days
                is_sideways = True
            elif cv < 4.0:  # Moderate compression (<4%)
                score = 20
                sideways_days = max(days - 3, 5)
                is_sideways = True
            elif cv < 5.0:  # Loose compression (<5%)
                score = 10
                sideways_days = max(days - 5, 3)
                is_sideways = True
            else:
                score = 0
                sideways_days = 0
                is_sideways = False
            
            return {
                "is_sideways": is_sideways,
                "compression_score": score,
                "sideways_days": sideways_days,
                "volatility_pct": round(cv, 2),
                "price_range_pct": round(price_range_pct, 2),
                "avg_close": round(mean_close, 2)
            }
            
        finally:
            conn.close()
    
    def calculate_flow_impact(
        self, 
        ticker: str, 
        trade_date: str
    ) -> Dict[str, Any]:
        """
        Calculate flow impact: how significant the trading value is relative to market cap.
        
        Flow Impact = (Volume × Close Price) / Market Cap × 100
        
        Higher impact indicates more significant trading activity relative to company size.
        
        Args:
            ticker: Stock ticker symbol
            trade_date: Date to calculate impact for (YYYY-MM-DD)
            
        Returns:
            {
                "flow_impact_pct": float,
                "value_traded": float,
                "market_cap": float,
                "flow_score": int (0-30),
                "has_market_cap": bool
            }
        """
        from db.market_metadata_repository import MarketMetadataRepository
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            # Get volume and close for the date
            cursor.execute("""
                SELECT volume, close
                FROM price_volume
                WHERE ticker = ? AND trade_date = ?
            """, (ticker.upper(), trade_date))
            
            row = cursor.fetchone()
            
            if not row:
                return {
                    "flow_impact_pct": 0,
                    "value_traded": 0,
                    "market_cap": 0,
                    "flow_score": 0,
                    "has_market_cap": False
                }
            
            volume = row[0]
            close = row[1]
            value_traded = volume * close
            
            # Get market cap from market metadata
            market_repo = MarketMetadataRepository()
            mcap_data = market_repo.get_market_cap_history(ticker, days=1)
            
            if not mcap_data or mcap_data[0].get('market_cap', 0) <= 0:
                # Try to get shares outstanding and calculate
                shares = market_repo.get_shares_outstanding(ticker)
                if shares and shares > 0:
                    market_cap = shares * close
                else:
                    return {
                        "flow_impact_pct": 0,
                        "value_traded": value_traded,
                        "market_cap": 0,
                        "flow_score": 0,
                        "has_market_cap": False
                    }
            else:
                market_cap = mcap_data[0]['market_cap']
            
            # Calculate flow impact percentage
            flow_impact_pct = (value_traded / market_cap * 100) if market_cap > 0 else 0
            
            # Determine score based on flow impact
            if flow_impact_pct >= 5.0:  # Very high impact
                score = 30
            elif flow_impact_pct >= 3.0:  # High impact
                score = 25
            elif flow_impact_pct >= 2.0:  # Notable impact
                score = 20
            elif flow_impact_pct >= 1.0:  # Moderate impact
                score = 15
            elif flow_impact_pct >= 0.5:  # Low impact
                score = 10
            else:
                score = 0
            
            return {
                "flow_impact_pct": round(flow_impact_pct, 3),
                "value_traded": round(value_traded),
                "market_cap": round(market_cap),
                "flow_score": score,
                "has_market_cap": True
            }
            
        finally:
            conn.close()
    
    def calculate_anomaly_score(
        self,
        ticker: str,
        trade_date: str,
        volume_ratio: float
    ) -> Dict[str, Any]:
        """
        Calculate composite anomaly score (0-100) for Alpha Hunter Stage 1.
        
        Combines three factors:
        - Volume Spike Score (0-40): Based on volume vs median ratio
        - Compression Score (0-30): Based on sideways consolidation
        - Flow Impact Score (0-30): Based on value traded vs market cap
        
        Signal levels:
        - FIRE (80-100): Very strong signal
        - HOT (60-79): Strong signal
        - WARM (40-59): Moderate signal
        
        Args:
            ticker: Stock ticker symbol
            trade_date: Date of the volume spike
            volume_ratio: Pre-calculated volume/median ratio
            
        Returns:
            {
                "total_score": int (0-100),
                "signal_level": str,
                "breakdown": {
                    "volume_score": int,
                    "compression_score": int,
                    "flow_score": int
                },
                "compression_data": {...},
                "flow_data": {...}
            }
        """
        # 1. Volume Score (0-40)
        if volume_ratio >= 5.0:
            volume_score = 40
        elif volume_ratio >= 3.0:
            volume_score = 35
        elif volume_ratio >= 2.5:
            volume_score = 30
        elif volume_ratio >= 2.0:
            volume_score = 25
        elif volume_ratio >= 1.5:
            volume_score = 15
        else:
            volume_score = 0
        
        # 2. Compression Score (0-30)
        compression_data = self.detect_sideways_compression(ticker, days=15)
        compression_score = compression_data.get("compression_score", 0)
        
        # 3. Flow Impact Score (0-30)
        flow_data = self.calculate_flow_impact(ticker, trade_date)
        flow_score = flow_data.get("flow_score", 0)
        
        # Total Score
        total_score = volume_score + compression_score + flow_score
        
        # Signal Level
        if total_score >= 80:
            signal_level = "FIRE"
        elif total_score >= 60:
            signal_level = "HOT"
        elif total_score >= 40:
            signal_level = "WARM"
        else:
            signal_level = "COLD"
        
        return {
            "total_score": total_score,
            "signal_level": signal_level,
            "breakdown": {
                "volume_score": volume_score,
                "compression_score": compression_score,
                "flow_score": flow_score
            },
            "compression_data": compression_data,
            "flow_data": flow_data
        }
    
    def scan_with_scoring(
        self,
        scan_days: int = 30,
        lookback_days: int = 20,
        min_ratio: float = 2.0,
        min_score: int = 40
    ) -> List[Dict[str, Any]]:
        """
        Enhanced unusual volume scan with composite scoring.
        
        This is the main entry point for Alpha Hunter Stage 1 scanner.
        It detects unusual volumes AND calculates composite anomaly scores.
        
        Args:
            scan_days: Number of recent days to scan
            lookback_days: Days to calculate median baseline
            min_ratio: Minimum volume/median ratio
            min_score: Minimum total score to include in results
            
        Returns:
            List of scored anomaly events, sorted by total_score descending
        """
        # First, get basic unusual volumes
        unusual = self.detect_unusual_volumes(
            scan_days=scan_days,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
        
        scored_results = []
        
        for event in unusual:
            ticker = event['ticker']
            trade_date = event['date']
            volume_ratio = event['ratio']
            
            # Calculate full anomaly score
            score_data = self.calculate_anomaly_score(
                ticker=ticker,
                trade_date=trade_date,
                volume_ratio=volume_ratio
            )
            
            if score_data['total_score'] >= min_score:
                # Merge event data with score data
                scored_event = {
                    **event,
                    **score_data
                }
                scored_results.append(scored_event)
        
        # Sort by total score descending
        scored_results.sort(key=lambda x: x['total_score'], reverse=True)
        
        return scored_results


# Global instance
price_volume_repo = PriceVolumeRepository()

