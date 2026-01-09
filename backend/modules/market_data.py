"""
Market Data Module
Responsible for fetching, caching, and serving OHLCV data.
Uses yfinance for external data and SQLite for local caching.
"""
import yfinance as yf
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
from db.connection import DatabaseConnection

class MarketData:
    def __init__(self, db_path=None):
        self.db_conn = DatabaseConnection(db_path)
    
    def _get_conn(self):
        return self.db_conn._get_conn()

    def fetch_ohlcv(self, ticker: str, days: int = 365) -> pd.DataFrame:
        """
        Fetch OHLCV data for a ticker.
        Strategy: Smart Caching
        1. Check DB for existing data
        2. If data exists and is fresh (up to yesterday/today), return DB data
        3. If gap exists or data missing, fetch from yfinance and update DB
        """
        clean_ticker = ticker.replace('★', '').replace('⭐', '').strip()
        # Intelligent suffix handling
        if '.' in clean_ticker:
             yf_ticker = clean_ticker # Treat as full ticker (e.g. AAPL, BRMS.JK)
        else:
             yf_ticker = f"{clean_ticker}.JK" # Default to JK for simple symbols
        
        # 1. Check local cache
        df_local = self._get_local_data(clean_ticker, days)
        
        today = datetime.now().date()
        
        # Determine if we need to fetch
        need_fetch = False
        start_date = None
        
        if df_local.empty:
            need_fetch = True
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        else:
            # Check last date
            last_date_str = df_local.index.max().strftime('%Y-%m-%d') if isinstance(df_local.index, pd.DatetimeIndex) else df_local.index.max()
            last_date = datetime.strptime(last_date_str, '%Y-%m-%d').date()
            
            # If last date is older than today (or yesterday if market closed), fetch diff
            # Simple rule: if last_date < today, try to fetch from last_date
            if last_date < today:
                need_fetch = True
                start_date = (last_date + timedelta(days=1)).strftime('%Y-%m-%d')
        
        if need_fetch and start_date:
            try:
                # print(f"Fetching {yf_ticker} from {start_date}...")
                # Verify start_date is not in future
                if datetime.strptime(start_date, '%Y-%m-%d').date() <= today:
                    df_new = yf.download(yf_ticker, start=start_date, end=None, progress=False)
                    
                    if not df_new.empty:
                        # Handle MultiIndex columns (common in new yfinance)
                        if isinstance(df_new.columns, pd.MultiIndex):
                            df_new.columns = df_new.columns.get_level_values(0)
                            
                        # Normalize columns (lowercase)
                        df_new.columns = [c.lower() for c in df_new.columns]
                        
                        # Save to DB
                        self._save_to_db(clean_ticker, df_new)
                        
                        # Reload combined data
                        df_local = self._get_local_data(clean_ticker, days)
            except Exception as e:
                error_msg = f"Error fetching yfinance for {ticker}: {e}"
                print(error_msg)
                # Log to file for debugging
                try:
                    with open(r"C:\Data\AI Playground\project-searcher\debug_error.log", "a") as f:
                        f.write(f"{datetime.now()} - {error_msg}\n")
                except:
                    pass
                # Fallback to whatever local data we have
        
        return df_local

    def _get_local_data(self, ticker: str, days: int) -> pd.DataFrame:
        conn = self._get_conn()
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            query = """
                SELECT date, open, high, low, close, volume 
                FROM market_analytics_cache 
                WHERE ticker = ? AND date >= ?
                ORDER BY date ASC
            """
            df = pd.read_sql(query, conn, params=(ticker, start_date))
            
            if not df.empty:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                
            return df
        finally:
            conn.close()

    def _save_to_db(self, ticker: str, df: pd.DataFrame):
        conn = self._get_conn()
        try:
            # Prepare data
            data_to_insert = []
            for date, row in df.iterrows():
                # Handle MultiIndex if necessary (yfinance sometimes returns it)
                # Usually simple index 'Date'
                
                # Ensure we have scalar values (handle potential Series if duplicate columns exist)
                try:
                    open_val = float(row['open'].iloc[0]) if isinstance(row['open'], pd.Series) else float(row['open'])
                    high_val = float(row['high'].iloc[0]) if isinstance(row['high'], pd.Series) else float(row['high'])
                    low_val = float(row['low'].iloc[0]) if isinstance(row['low'], pd.Series) else float(row['low'])
                    close_val = float(row['close'].iloc[0]) if isinstance(row['close'], pd.Series) else float(row['close'])
                    vol_val = float(row['volume'].iloc[0]) if isinstance(row['volume'], pd.Series) else float(row['volume'])
                except Exception:
                    # Fallback for simple structure
                    open_val = float(row['open'])
                    high_val = float(row['high'])
                    low_val = float(row['low'])
                    close_val = float(row['close'])
                    vol_val = float(row['volume'])

                data_to_insert.append((
                    ticker,
                    date.strftime('%Y-%m-%d'),
                    open_val,
                    high_val,
                    low_val,
                    close_val,
                    vol_val
                ))
            
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT OR REPLACE INTO market_analytics_cache 
                (ticker, date, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, data_to_insert)
            conn.commit()
        except Exception as e:
            print(f"Error saving to DB: {e}")
        finally:
            conn.close()
