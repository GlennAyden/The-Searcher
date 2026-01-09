"""Market metadata repository for market cap caching with TTL."""
import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional
from .connection import BaseRepository


class MarketMetadataRepository(BaseRepository):
    """Repository for market metadata with TTL-based caching."""
    
    def get_market_cap(self, symbol: str, ttl_hours: int = 24) -> Optional[float]:
        """
        Get market cap with automatic caching and TTL validation.
        
        Args:
            symbol: Stock ticker (e.g., "BBCA")
            ttl_hours: Cache TTL in hours (default: 24)
            
        Returns:
            Market cap in IDR, or None if unavailable
        """
        # Clean symbol
        clean_symbol = symbol.strip().upper()
        
        # Check cache first
        cached = self._get_cached_market_cap(clean_symbol)
        
        if cached and not self._is_cache_expired(cached['cached_at'], ttl_hours):
            # Cache hit - return cached value
            return cached['market_cap']
        
        # Cache miss or expired - fetch from yfinance
        market_cap = self._fetch_from_yfinance(clean_symbol)
        
        if market_cap:
            # Save to cache
            self._save_cache(clean_symbol, market_cap)
            return market_cap
        
        # If fetch fails, return stale cache if available
        if cached:
            print(f"[WARNING] yfinance failed for {clean_symbol}, using stale cache")
            return cached['market_cap']
        
        return None
    
    def _get_cached_market_cap(self, symbol: str) -> Optional[dict]:
        """
        Retrieve cached market cap from database.
        
        Args:
            symbol: Stock ticker
            
        Returns:
            Dict with market_cap and cached_at, or None
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT market_cap, cached_at FROM market_metadata WHERE symbol = ?",
                (symbol,)
            )
            row = cursor.fetchone()
            
            if row:
                return {
                    'market_cap': row[0],
                    'cached_at': row[1]
                }
            return None
        finally:
            conn.close()
    
    def _is_cache_expired(self, cached_at: str, ttl_hours: int) -> bool:
        """
        Check if cache has expired based on TTL.
        
        Args:
            cached_at: Timestamp when cached (ISO format)
            ttl_hours: Time-to-live in hours
            
        Returns:
            True if expired, False if still valid
        """
        try:
            cached_time = datetime.fromisoformat(cached_at)
            expiry_time = cached_time + timedelta(hours=ttl_hours)
            return datetime.now() > expiry_time
        except (ValueError, TypeError):
            # If parsing fails, consider expired
            return True
    
    def _fetch_from_yfinance(self, symbol: str) -> Optional[float]:
        """
        Fetch market cap from yfinance.
        
        Handles Indonesian stocks (.JK suffix) and converts to IDR.
        
        Args:
            symbol: Stock ticker
            
        Returns:
            Market cap in IDR, or None if fetch fails
        """
        try:
            # Determine yfinance ticker format
            if len(symbol) == 4 and symbol not in ["COMP", "IHSG", "JKSE"]:
                yf_ticker = f"{symbol}.JK"
            else:
                yf_ticker = symbol
            
            # Fetch data from yfinance
            ticker = yf.Ticker(yf_ticker)
            info = ticker.info
            
            # Get market cap (usually in stock's local currency)
            market_cap = info.get('marketCap')
            
            if not market_cap:
                print(f"[WARNING] No market cap data for {yf_ticker}")
                return None
            
            # Convert to float
            market_cap = float(market_cap)
            
            # For Indonesian stocks, market cap is typically in IDR already
            # For USD stocks, convert to IDR (assuming ~15,000 IDR/USD)
            currency = info.get('currency', 'IDR')
            if currency == 'USD':
                market_cap = market_cap * 15000  # Rough conversion
            
            print(f"[*] Fetched market cap for {symbol}: {market_cap:,.0f} IDR")
            return market_cap
            
        except Exception as e:
            print(f"[!] Error fetching market cap for {symbol}: {e}")
            return None
    
    def _save_cache(self, symbol: str, market_cap: float) -> None:
        """
        Save market cap to cache with current timestamp.
        
        Args:
            symbol: Stock ticker
            market_cap: Market cap value in IDR
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO market_metadata 
                (symbol, market_cap, currency, cached_at, source)
                VALUES (?, ?, 'IDR', ?, 'yfinance')
            """, (symbol, market_cap, datetime.now().isoformat()))
            
            conn.commit()
            print(f"[*] Cached market cap for {symbol}")
            
        except Exception as e:
            print(f"[!] Error caching market cap for {symbol}: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def clear_cache(self, symbol: Optional[str] = None) -> None:
        """
        Clear market cap cache.
        
        Args:
            symbol: If provided, clear only this symbol. Otherwise clear all.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            if symbol:
                cursor.execute("DELETE FROM market_metadata WHERE symbol = ?", (symbol.upper(),))
                print(f"[*] Cleared cache for {symbol}")
            else:
                cursor.execute("DELETE FROM market_metadata")
                print("[*] Cleared all market metadata cache")
            
            conn.commit()
        finally:
            conn.close()
