"""Market metadata repository for market cap caching with TTL."""
import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional
from .connection import BaseRepository


class MarketMetadataRepository(BaseRepository):
    """Repository for market metadata with TTL-based caching."""
    
    def get_metadata(self, symbol: str) -> Optional[dict]:
        """
        Backward-compatible metadata fetch.
        
        Returns cached market cap + shares outstanding when available.
        """
        clean_symbol = symbol.strip().upper()
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT market_cap, shares_outstanding, cached_at, last_price
                FROM market_metadata
                WHERE symbol = ?
                """,
                (clean_symbol,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "market_cap": row[0],
                "shares_outstanding": row[1],
                "cached_at": row[2],
                "last_price": row[3]
            }
        finally:
            conn.close()
    
    def upsert_metadata(self, symbol: str, data: dict) -> bool:
        """
        Backward-compatible metadata upsert.
        
        Accepts dicts with market_cap, shares_outstanding, last_price, last_updated.
        """
        clean_symbol = symbol.strip().upper()
        market_cap = data.get("market_cap")
        shares_outstanding = data.get("shares_outstanding")
        last_price = data.get("last_price")
        cached_at = data.get("last_updated") or data.get("cached_at") or datetime.now().isoformat()
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            if market_cap is None:
                cursor.execute(
                    """
                    UPDATE market_metadata
                    SET shares_outstanding = COALESCE(?, shares_outstanding),
                        last_price = COALESCE(?, last_price),
                        cached_at = ?
                    WHERE symbol = ?
                    """,
                    (shares_outstanding, last_price, cached_at, clean_symbol)
                )
                conn.commit()
                return cursor.rowcount > 0
            
            cursor.execute(
                """
                INSERT OR REPLACE INTO market_metadata
                (symbol, market_cap, currency, cached_at, source, shares_outstanding, last_price)
                VALUES (?, ?, 'IDR', ?, 'yfinance', ?, ?)
                """,
                (clean_symbol, market_cap, cached_at, shares_outstanding, last_price)
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error upserting market metadata for {clean_symbol}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
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
    
    def get_shares_outstanding(self, symbol: str, ttl_hours: int = 168) -> Optional[float]:
        """
        Get shares outstanding for a stock (cached for 1 week).
        
        Args:
            symbol: Stock ticker (e.g., "BBCA")
            ttl_hours: Cache TTL in hours (default: 168 = 1 week)
            
        Returns:
            Shares outstanding, or None if unavailable
        """
        clean_symbol = symbol.strip().upper()
        
        # Check if we have it cached in market_metadata
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT shares_outstanding, cached_at FROM market_metadata WHERE symbol = ?",
                (clean_symbol,)
            )
            row = cursor.fetchone()
            
            if row and row[0] and not self._is_cache_expired(row[1], ttl_hours):
                return row[0]
        finally:
            conn.close()
        
        # Fetch from yfinance
        try:
            if len(clean_symbol) == 4 and clean_symbol not in ["COMP", "IHSG", "JKSE"]:
                yf_ticker = f"{clean_symbol}.JK"
            else:
                yf_ticker = clean_symbol
            
            ticker = yf.Ticker(yf_ticker)
            info = ticker.info
            
            shares = info.get('sharesOutstanding')
            if shares:
                self._update_shares_outstanding(clean_symbol, float(shares))
                return float(shares)
                
        except Exception as e:
            print(f"[!] Error fetching shares outstanding for {symbol}: {e}")
        
        return None
    
    def _update_shares_outstanding(self, symbol: str, shares: float) -> None:
        """Update shares outstanding in market_metadata cache."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            # Update if exists, the shares_outstanding column
            cursor.execute("""
                UPDATE market_metadata 
                SET shares_outstanding = ?, cached_at = ?
                WHERE symbol = ?
            """, (shares, datetime.now().isoformat(), symbol))
            
            if cursor.rowcount == 0:
                # Row doesn't exist yet, we'll create it when market cap is fetched
                pass
            
            conn.commit()
        finally:
            conn.close()
    
    def save_market_cap_snapshot(self, ticker: str, trade_date: str, 
                                  market_cap: float, shares_outstanding: float = None,
                                  close_price: float = None) -> bool:
        """
        Save a market cap snapshot for a specific date.
        
        Args:
            ticker: Stock ticker
            trade_date: Date string (YYYY-MM-DD)
            market_cap: Market cap value
            shares_outstanding: Optional shares count
            close_price: Optional close price used for calculation
            
        Returns:
            True if saved successfully
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO market_cap_history 
                (ticker, trade_date, market_cap, shares_outstanding, close_price, calculated_at, source)
                VALUES (?, ?, ?, ?, ?, ?, 'calculated')
            """, (ticker.upper(), trade_date, market_cap, shares_outstanding, 
                  close_price, datetime.now().isoformat()))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error saving market cap snapshot for {ticker}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_market_cap_history(self, ticker: str, days: int = 90) -> list:
        """
        Get historical market cap data for a ticker.
        
        Args:
            ticker: Stock ticker
            days: Number of days of history (default: 90)
            
        Returns:
            List of dicts with trade_date, market_cap, shares_outstanding, close_price
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT trade_date, market_cap, shares_outstanding, close_price
                FROM market_cap_history
                WHERE ticker = ?
                ORDER BY trade_date DESC
                LIMIT ?
            """, (ticker.upper(), days))
            
            rows = cursor.fetchall()
            return [
                {
                    'date': row[0],
                    'market_cap': row[1],
                    'shares_outstanding': row[2],
                    'close_price': row[3]
                }
                for row in reversed(rows)  # Return in chronological order
            ]
        finally:
            conn.close()
    
    def calculate_and_save_market_cap_from_ohlcv(self, ticker: str, 
                                                  ohlcv_data: list,
                                                  shares_outstanding: float) -> int:
        """
        Calculate and save market cap history from OHLCV data.
        
        Args:
            ticker: Stock ticker
            ohlcv_data: List of OHLCV records with 'time' and 'close'
            shares_outstanding: Current shares outstanding
            
        Returns:
            Number of records saved
        """
        if not ohlcv_data or not shares_outstanding:
            return 0
        
        saved = 0
        for record in ohlcv_data:
            trade_date = record.get('time')
            close_price = record.get('close')
            
            if trade_date and close_price:
                market_cap = close_price * shares_outstanding
                if self.save_market_cap_snapshot(
                    ticker, trade_date, market_cap, shares_outstanding, close_price
                ):
                    saved += 1
        
        return saved

