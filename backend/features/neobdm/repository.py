"""
NeoBDM Repository - CRUD operations only.

This is a slimmed-down repository containing only data access operations.
Analysis logic has been extracted to the analysis/ submodule.
"""
import pandas as pd
import re
from typing import Optional, List, Dict
from datetime import datetime
from db.connection import BaseRepository


class NeoBDMRepository(BaseRepository):
    """Repository for NeoBDM market maker and fund flow data."""

    def _parse_numeric(self, value) -> float:
        """Parse numeric values from scraper or API payloads safely."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        try:
            clean = re.sub(r'[^\d.-]', '', str(value))
            return float(clean) if clean else 0.0
        except Exception:
            return 0.0
    
    # ========================================================================
    # CRUD - NeoBDM Records
    # ========================================================================
    
    def save_neobdm_summary(self, method: str, period: str, data_list: List[Dict]) -> None:
        """Save a neobdm summary scrape as a JSON blob (legacy format)."""
        import json
        conn = self._get_conn()
        try:
            conn.execute(
                """
                INSERT INTO neobdm_summaries (scraped_at, method, period, data_json)
                VALUES (datetime('now'), ?, ?, ?)
                """,
                (method, period, json.dumps(data_list))
            )
            conn.commit()
        finally:
            conn.close()
    
    def save_neobdm_record_batch(
        self,
        method: str,
        period: str,
        data_list: List[Dict],
        scraped_at: Optional[str] = None
    ) -> int:
        """Save a batch of neobdm records into the structured table."""
        if not data_list:
            return 0
        
        if scraped_at is None:
            scraped_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        conn = self._get_conn()
        try:
            query = """
            INSERT INTO neobdm_records (
                scraped_at, method, period, symbol, pinky, crossing, likuid,
                w_4, w_3, w_2, w_1, d_4, d_3, d_2, d_0, pct_1d,
                c_20, c_10, c_5, c_3, pct_3d, pct_5d, pct_10d, pct_20d,
                price, ma5, ma10, ma20, ma50, ma100, unusual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            def get_val(item: Dict, *keys: str):
                for key in keys:
                    if not key:
                        continue
                    if key in item:
                        return item[key]
                    upper = key.upper()
                    lower = key.lower()
                    if upper in item:
                        return item[upper]
                    if lower in item:
                        return item[lower]
                return None

            rows_to_insert = []
            for item in data_list:
                raw_symbol = get_val(item, 'symbol', 'ticker') or ''
                clean_symbol = re.sub(r'\|?Add\s+.*?to\s+Watchlist', '', raw_symbol, flags=re.IGNORECASE)
                clean_symbol = re.sub(r'\|?Remove\s+from\s+Watchlist', '', clean_symbol, flags=re.IGNORECASE)
                clean_symbol = clean_symbol.encode("ascii", errors="ignore").decode().strip('| ').strip()
                if not clean_symbol:
                    continue

                row = (
                    scraped_at, method, period,
                    clean_symbol.upper(),
                    get_val(item, 'pinky'),
                    get_val(item, 'crossing'),
                    get_val(item, 'likuid'),
                    get_val(item, 'w-4', 'wn-4', 'w_4'),
                    get_val(item, 'w-3', 'wn-3', 'w_3'),
                    get_val(item, 'w-2', 'wn-2', 'w_2'),
                    get_val(item, 'w-1', 'wn-1', 'w_1'),
                    get_val(item, 'd-4', 'dn-4', 'd_4'),
                    get_val(item, 'd-3', 'dn-3', 'd_3'),
                    get_val(item, 'd-2', 'dn-2', 'd_2'),
                    get_val(item, 'd-0', 'dn-0', 'd_0'),
                    get_val(item, '%1d', 'pct_1d'),
                    get_val(item, 'c-20', 'cn-20', 'c_20'),
                    get_val(item, 'c-10', 'cn-10', 'c_10'),
                    get_val(item, 'c-5', 'cn-5', 'c_5'),
                    get_val(item, 'c-3', 'cn-3', 'c_3'),
                    get_val(item, '%3d', 'pct_3d'),
                    get_val(item, '%5d', 'pct_5d'),
                    get_val(item, '%10d', 'pct_10d'),
                    get_val(item, '%20d', 'pct_20d'),
                    get_val(item, 'price', 'p'),
                    get_val(item, 'ma5', '>ma5'),
                    get_val(item, 'ma10', '>ma10'),
                    get_val(item, 'ma20', '>ma20'),
                    get_val(item, 'ma50', '>ma50'),
                    get_val(item, 'ma100', '>ma100'),
                    get_val(item, 'unusual')
                )
                rows_to_insert.append(row)

            if rows_to_insert:
                conn.executemany(query, rows_to_insert)
                conn.commit()
            return len(rows_to_insert)
        finally:
            conn.close()
    
    def get_neobdm_summaries(
        self,
        method: Optional[str] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """Fetch historical NeoBDM summaries."""
        conn = self._get_conn()
        try:
            query = "SELECT * FROM neobdm_records WHERE 1=1"
            params = []
            
            if method:
                query += " AND method = ?"
                params.append(method)
            if period:
                query += " AND period = ?"
                params.append(period)
            if start_date:
                query += " AND scraped_at >= ?"
                params.append(start_date)
            if end_date:
                query += " AND scraped_at <= ?"
                params.append(end_date)
            
            query += " ORDER BY scraped_at DESC"
            return pd.read_sql(query, conn, params=params)
        finally:
            conn.close()
    
    def get_available_neobdm_dates(self) -> List[str]:
        """Get list of distinct dates available in neobdm_records."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT DISTINCT DATE(scraped_at) as trade_date FROM neobdm_records ORDER BY trade_date DESC"
            )
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    def get_neobdm_tickers(self) -> List[str]:
        """Get list of all unique tickers in NeoBDM data."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT DISTINCT symbol FROM neobdm_records ORDER BY symbol"
            )
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    def get_records_for_symbol(self, symbol: str, method: str = 'm', period: str = 'c', limit: int = 30) -> pd.DataFrame:
        """Get historical records for a symbol."""
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM neobdm_records
            WHERE symbol = ? AND method = ? AND period = ?
            ORDER BY scraped_at DESC
            LIMIT ?
            """
            return pd.read_sql(query, conn, params=(symbol.upper(), method, period, limit))
        finally:
            conn.close()
    
    def get_latest_records_for_method(self, method: str = 'm') -> pd.DataFrame:
        """Get latest records for each symbol for a given method."""
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM neobdm_records
            WHERE method = ? AND scraped_at = (
                SELECT MAX(scraped_at) FROM neobdm_records WHERE method = ?
            )
            """
            return pd.read_sql(query, conn, params=(method, method))
        finally:
            conn.close()
    
    # ========================================================================
    # CRUD - Broker Summary
    # ========================================================================
    
    def save_broker_summary_batch(
        self,
        ticker: str,
        trade_date: str,
        buy_data: List[Dict],
        sell_data: List[Dict]
    ) -> int:
        """Save a batch of broker summary records."""
        if not buy_data and not sell_data:
            return 0

        conn = self._get_conn()
        try:
            scraped_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Clear existing for this ticker/date
            conn.execute(
                "DELETE FROM neobdm_broker_summaries WHERE UPPER(ticker) = UPPER(?) AND trade_date = ?",
                (ticker, trade_date)
            )
            
            rows_to_insert = []
            
            # Save buy data
            for row in buy_data:
                broker = row.get('broker') or row.get('broker_code') or row.get('code') or ''
                if not broker:
                    continue
                nlot = self._parse_numeric(row.get('nlot', row.get('net_lot', 0)))
                nval = self._parse_numeric(row.get('nval', row.get('net_value', 0)))
                avg_price = self._parse_numeric(
                    row.get('bavg', row.get('avg_price', row.get('avg', 0)))
                )
                rows_to_insert.append((
                    ticker.upper(), trade_date, 'BUY',
                    broker.upper(), nlot, nval, avg_price, scraped_at
                ))
            
            # Save sell data
            for row in sell_data:
                broker = row.get('broker') or row.get('broker_code') or row.get('code') or ''
                if not broker:
                    continue
                nlot = self._parse_numeric(row.get('nlot', row.get('net_lot', 0)))
                nval = self._parse_numeric(row.get('nval', row.get('net_value', 0)))
                avg_price = self._parse_numeric(
                    row.get('savg', row.get('avg_price', row.get('avg', 0)))
                )
                rows_to_insert.append((
                    ticker.upper(), trade_date, 'SELL',
                    broker.upper(), nlot, nval, avg_price, scraped_at
                ))

            if rows_to_insert:
                conn.executemany(
                    """
                    INSERT INTO neobdm_broker_summaries
                    (ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    rows_to_insert
                )
            
            conn.commit()
            return len(rows_to_insert)
        finally:
            conn.close()
    
    def get_broker_summary(self, ticker: str, trade_date: str) -> Dict:
        """Get broker summary data for a specific ticker and date."""
        conn = self._get_conn()
        try:
            query = """
            SELECT
                broker AS broker,
                broker AS broker_code,
                nlot AS nlot,
                nlot AS net_lot,
                nval AS nval,
                nval AS net_value,
                avg_price AS avg_price,
                side AS side
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = UPPER(?) AND trade_date = ?
            ORDER BY ABS(nval) DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))

            if not df.empty:
                for col in ["nlot", "nval", "avg_price", "net_lot", "net_value"]:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            
            return {
                "ticker": ticker.upper(),
                "trade_date": trade_date,
                "buy_data": df[df['side'] == 'BUY'].to_dict('records'),
                "sell_data": df[df['side'] == 'SELL'].to_dict('records')
            }
        finally:
            conn.close()
    
    def get_available_dates_for_ticker(self, ticker: str) -> List[str]:
        """Get all available dates where broker summary data exists for a ticker."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT DISTINCT trade_date 
                FROM neobdm_broker_summaries 
                WHERE UPPER(ticker) = UPPER(?) 
                ORDER BY trade_date DESC
                """,
                (ticker,)
            )
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    def get_broker_summary_range(self, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Get broker summary for a date range."""
        conn = self._get_conn()
        try:
            query = """
            SELECT
                ticker,
                trade_date,
                side,
                broker AS broker_code,
                broker AS broker,
                CASE WHEN side = 'SELL' THEN -nlot ELSE nlot END AS net_lot,
                CASE WHEN side = 'SELL' THEN -nval ELSE nval END AS net_value,
                avg_price
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = UPPER(?) AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date DESC, ABS(nval) DESC
            """
            df = pd.read_sql(query, conn, params=(ticker, start_date, end_date))
            if not df.empty:
                for col in ["net_lot", "net_value", "avg_price"]:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            return df
        finally:
            conn.close()
    
    # ========================================================================
    # CRUD - Volume Data
    # ========================================================================
    
    def save_volume_batch(self, ticker: str, records: List[Dict]) -> int:
        """Save a batch of volume records for a ticker."""
        conn = self._get_conn()
        try:
            count = 0
            for rec in records:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO volume_daily_records
                    (ticker, trade_date, volume, open_price, high_price, low_price, close_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ticker.upper(),
                        rec.get('trade_date', ''),
                        rec.get('volume', 0),
                        rec.get('open_price', 0),
                        rec.get('high_price', 0),
                        rec.get('low_price', 0),
                        rec.get('close_price', 0)
                    )
                )
                count += 1
            conn.commit()
            return count
        finally:
            conn.close()
    
    def get_volume_history(
        self,
        ticker: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """Get volume history for a ticker within a date range."""
        conn = self._get_conn()
        try:
            query = "SELECT * FROM volume_daily_records WHERE ticker = ?"
            params = [ticker.upper()]
            
            if start_date:
                query += " AND trade_date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND trade_date <= ?"
                params.append(end_date)
            
            query += " ORDER BY trade_date DESC"
            df = pd.read_sql(query, conn, params=params)
            return df.to_dict('records')
        finally:
            conn.close()
    
    def get_latest_volume_date(self, ticker: str) -> Optional[str]:
        """Get the latest trade date for which we have volume data."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT MAX(trade_date) FROM volume_daily_records WHERE ticker = ?",
                (ticker.upper(),)
            )
            row = cursor.fetchone()
            return row[0] if row and row[0] else None
        finally:
            conn.close()
