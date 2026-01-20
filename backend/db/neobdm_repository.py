"""NeoBDM repository for market maker and fund flow analysis."""
import pandas as pd
import json
import re
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from .connection import BaseRepository


class NeoBDMRepository(BaseRepository):
    """Repository for NeoBDM market maker and fund flow data."""
    
    def _calculate_method_confluence(self, symbol: str, scraped_at: str) -> tuple:
        """
        New Logic: Multi-Method Confluence Analysis.
        Cross-references flows from different methods (MM, Non-Retail, Foreign).
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT method, d_0 
            FROM neobdm_records 
            WHERE symbol = ? AND scraped_at = ?
            """
            cursor = conn.cursor()
            cursor.execute(query, (symbol, scraped_at))
            rows = cursor.fetchall()
            
            flows = {row[0]: self._parse_numeric(row[1]) for row in rows}
            
            confluence_score = 0
            positive_methods = [m for m, f in flows.items() if f > 0]
            
            if len(positive_methods) >= 3:
                confluence_score = 50  # TRIPLE THREAT: All methods agree
                status = "TRIPLE_CONFLUENCE"
            elif len(positive_methods) == 2:
                confluence_score = 25  # DOUBLE CONFIRMATION
                status = "DOUBLE_CONFLUENCE"
            else:
                confluence_score = 0
                status = "SINGLE_METHOD"
                
            return confluence_score, status, positive_methods
        finally:
            conn.close()

    def save_neobdm_summary(self, method: str, period: str, data_list: List[Dict]):
        """
        Save a neobdm summary scrape as a JSON blob (legacy format).
        
        Args:
            method: Analysis method (m/nr/f)
            period: Time period (d/c)
            data_list: List of data dictionaries
        """
        conn = self._get_conn()
        try:
            query = "INSERT INTO neobdm_summaries (scraped_at, method, period, data_json) VALUES (datetime('now'), ?, ?, ?)"
            conn.execute(query, (method, period, json.dumps(data_list)))
            conn.commit()
            print(f"[*] Saved NeoBDM summary ({method}/{period}) to SQLite.")
        except Exception as e:
            print(f"[!] Error saving NeoBDM: {e}")
        finally:
            conn.close()
    
    def save_neobdm_record_batch(
        self,
        method: str,
        period: str,
        data_list: List[Dict],
        scraped_at: Optional[str] = None
    ):
        """
        Save a batch of neobdm records into the structured table.
        
        Args:
            method: Analysis method
            period: Time period
            data_list: List of records
            scraped_at: Timestamp (uses current time if None)
        """
        conn = self._get_conn()
        try:
            if not scraped_at:
                scraped_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            query = """
            INSERT INTO neobdm_records (
                scraped_at, method, period, symbol, pinky, crossing, likuid,
                w_4, w_3, w_2, w_1, d_4, d_3, d_2, d_0, pct_1d,
                c_20, c_10, c_5, c_3, pct_3d, pct_5d, pct_10d, pct_20d,
                price, ma5, ma10, ma20, ma50, ma100, unusual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            rows_to_insert = []
            for item in data_list:
                # Backend safety gate: Clean watchlist junk from symbol
                raw_symbol = item.get('symbol', '') or ''
                clean_symbol = re.sub(r'\|?Add\s+.*?to\s+Watchlist', '', raw_symbol, flags=re.IGNORECASE)
                clean_symbol = re.sub(r'\|?Add\s+.*?to\s+Watchlist', '', raw_symbol, flags=re.IGNORECASE)
                clean_symbol = re.sub(r'\|?Remove\s+from\s+Watchlist', '', clean_symbol, flags=re.IGNORECASE)
                # Clean Star Emojis and other junk
                clean_symbol = clean_symbol.replace('★', '').replace('⭐', '').strip('| ').strip()
                
                # Function to get value regardless of case
                def get_val(key_lower):
                    return item.get(key_lower) or item.get(key_lower.upper())

                row = (
                    scraped_at, method, period, 
                    clean_symbol, get_val('pinky'), get_val('crossing'), get_val('likuid'),
                    get_val('w-4') or get_val('wn-4'), get_val('w-3') or get_val('wn-3'),
                    get_val('w-2') or get_val('wn-2'), get_val('w-1') or get_val('wn-1'),
                    get_val('d-4') or get_val('dn-4'), get_val('d-3') or get_val('dn-3'),
                    get_val('d-2') or get_val('dn-2'), get_val('d-0') or get_val('dn-0'),
                    get_val('%1d'),
                    get_val('c-20') or get_val('cn-20'), get_val('c-10') or get_val('cn-10'),
                    get_val('c-5') or get_val('cn-5'), get_val('c-3') or get_val('cn-3'),
                    get_val('%3d'), get_val('%5d'), get_val('%10d'), get_val('%20d'),
                    get_val('price') or item.get('P'), 
                    get_val('ma5') or item.get('>ma5'), 
                    get_val('ma10') or item.get('>ma10'), 
                    get_val('ma20') or item.get('>ma20'),
                    get_val('ma50') or item.get('>ma50'), 
                    get_val('ma100') or item.get('>ma100'), 
                    get_val('unusual')
                )
                rows_to_insert.append(row)
            
            conn.executemany(query, rows_to_insert)
            conn.commit()
            print(f"[*] Saved {len(rows_to_insert)} structured NeoBDM records ({method}/{period}) to SQLite.")
        except Exception as e:
            print(f"[!] Error saving structured NeoBDM batch: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def save_broker_summary_batch(
        self,
        ticker: str,
        trade_date: str,
        buy_data: List[Dict],
        sell_data: List[Dict]
    ):
        """
        Save a batch of broker summary records.
        
        Args:
            ticker: Stock ticker
            trade_date: Date of the trade data
            buy_data: List of net buy records
            sell_data: List of net sell records
        """
        conn = self._get_conn()
        try:
            scraped_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Delete existing data for this ticker and date to avoid duplicates
            conn.execute(
                "DELETE FROM neobdm_broker_summaries WHERE UPPER(ticker) = UPPER(?) AND trade_date = ?",
                (ticker, trade_date)
            )
            
            query = """
            INSERT INTO neobdm_broker_summaries (
                ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            rows_to_insert = []
            
            # Process Buy Data
            for item in buy_data:
                # Flexible key access
                broker = item.get('broker')
                nlot = self._parse_numeric(item.get('nlot', item.get('net lot', 0)))
                nval = self._parse_numeric(item.get('nval', item.get('net val', 0)))
                bavg = self._parse_numeric(item.get('bavg', item.get('avg price', 0)))
                
                rows_to_insert.append((
                    ticker.upper(), trade_date, 'BUY',
                    broker, nlot, nval, bavg, scraped_at
                ))
                
            # Process Sell Data
            for item in sell_data:
                broker = item.get('broker')
                nlot = self._parse_numeric(item.get('nlot', item.get('net lot', 0)))
                nval = self._parse_numeric(item.get('nval', item.get('net val', 0)))
                savg = self._parse_numeric(item.get('savg', item.get('avg price', 0)))
                
                rows_to_insert.append((
                    ticker.upper(), trade_date, 'SELL',
                    broker, nlot, nval, savg, scraped_at
                ))
            
            if rows_to_insert:
                conn.executemany(query, rows_to_insert)
                conn.commit()
                print(f"[*] Saved {len(rows_to_insert)} broker summary records for {ticker} on {trade_date}.")
        except Exception as e:
            print(f"[!] Error saving broker summary batch: {e}")
            conn.rollback()
        finally:
            conn.close()

    def get_broker_summary(self, ticker: str, trade_date: str) -> Dict[str, List[Dict]]:
        """
        Get broker summary data for a specific ticker and date.
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT side, broker, nlot, nval, avg_price 
            FROM neobdm_broker_summaries 
            WHERE UPPER(ticker) = UPPER(?) AND trade_date = ?
            ORDER BY nval DESC
            """
            df = pd.read_sql(query, conn, params=(ticker, trade_date))
            
            if df.empty:
                return {"buy": [], "sell": []}
                
            buy_data = df[df['side'] == 'BUY'].to_dict('records')
            sell_data = df[df['side'] == 'SELL'].to_dict('records')
            
            return {
                "buy": buy_data,
                "sell": sell_data
            }
        finally:
            conn.close()
    
    def get_available_dates_for_ticker(self, ticker: str) -> List[str]:
        """
        Get all available dates where broker summary data exists for a ticker.
        
        Args:
            ticker: Stock ticker symbol
        
        Returns:
            List of date strings (YYYY-MM-DD) in descending order
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT DISTINCT trade_date 
            FROM neobdm_broker_summaries 
            WHERE UPPER(ticker) = UPPER(?)
            ORDER BY trade_date DESC
            """
            df = pd.read_sql(query, conn, params=(ticker,))
            return df['trade_date'].tolist() if not df.empty else []
        finally:
            conn.close()
    
    def get_broker_journey(
        self, 
        ticker: str,
        brokers: List[str],
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Get broker journey data showing accumulation/distribution patterns over time.
        
        Args:
            ticker: Stock ticker symbol
            brokers: List of broker codes to track
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            Dictionary with broker journey data, summaries, and price data
        """
        conn = self._get_conn()
        try:
            # Query for all data in date range
            query = """
            SELECT trade_date, side, broker, nlot, nval, avg_price
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = UPPER(?)
              AND trade_date >= ?
              AND trade_date <= ?
              AND UPPER(broker) IN ({})
            ORDER BY trade_date ASC, side ASC
            """.format(','.join(['?'] * len(brokers)))
            
            params = [ticker, start_date, end_date] + [b.upper() for b in brokers]
            df = pd.read_sql(query, conn, params=params)
            
            # Fetch price data from yfinance via MarketData module
            price_data = []
            try:
                from modules.market_data import MarketData
                market_data = MarketData()
                
                # Calculate days from start_date to today for fetching
                from datetime import datetime
                start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                today = datetime.now()
                days_diff = (today - start_dt).days + 30  # Extra buffer for weekends/holidays
                
                # Fetch OHLCV data
                ohlcv_df = market_data.fetch_ohlcv(ticker, days=max(days_diff, 60))
                
                if not ohlcv_df.empty:
                    # Filter to date range
                    ohlcv_df.index = pd.to_datetime(ohlcv_df.index)
                    mask = (ohlcv_df.index >= start_date) & (ohlcv_df.index <= end_date)
                    filtered_df = ohlcv_df.loc[mask]
                    
                    for date_val, row in filtered_df.iterrows():
                        date_str = date_val.strftime('%Y-%m-%d')
                        close_price = float(row['close']) if 'close' in row else 0.0
                        price_data.append({
                            "date": date_str,
                            "close_price": round(close_price, 0)
                        })
            except Exception as e:
                print(f"[WARNING] Failed to fetch price data for {ticker}: {e}")
                # Continue without price data - broker journey still works
            
            if df.empty:
                return {
                    "ticker": ticker,
                    "date_range": {"start": start_date, "end": end_date},
                    "brokers": [],
                    "price_data": price_data
                }
            
            # Process each broker
            broker_results = []
            
            for broker_code in brokers:
                broker_df = df[df['broker'].str.upper() == broker_code.upper()]
                
                if broker_df.empty:
                    continue  # Skip brokers with no activity
                
                # Group by date and aggregate buy/sell
                daily_data = []
                cumulative_net_lot = 0
                cumulative_net_value = 0
                
                dates = sorted(broker_df['trade_date'].unique())
                
                for trade_date in dates:
                    day_df = broker_df[broker_df['trade_date'] == trade_date]
                    
                    # Aggregate buy and sell
                    buy_rows = day_df[day_df['side'] == 'BUY']
                    sell_rows = day_df[day_df['side'] == 'SELL']
                    
                    # Convert all pandas/numpy types to Python native types immediately
                    buy_lot = float(buy_rows['nlot'].sum()) if not buy_rows.empty else 0.0
                    buy_value = float(buy_rows['nval'].sum()) if not buy_rows.empty else 0.0
                    buy_avg = float(buy_rows['avg_price'].mean()) if not buy_rows.empty else 0.0
                    
                    sell_lot = float(sell_rows['nlot'].sum()) if not sell_rows.empty else 0.0
                    sell_value = float(sell_rows['nval'].sum()) if not sell_rows.empty else 0.0
                    sell_avg = float(sell_rows['avg_price'].mean()) if not sell_rows.empty else 0.0
                    
                    # Handle NaN values from pandas
                    import math
                    if math.isnan(buy_avg):
                        buy_avg = 0.0
                    if math.isnan(sell_avg):
                        sell_avg = 0.0
                    
                    # Calculate net values
                    net_lot = buy_lot - sell_lot
                    net_value = buy_value - sell_value
                    
                    # Update cumulative
                    cumulative_net_lot += net_lot
                    cumulative_net_value += net_value
                    
                    daily_data.append({
                        "date": trade_date,
                        "buy_lot": int(buy_lot),
                        "buy_value": round(buy_value, 2),
                        "buy_avg_price": round(buy_avg, 0),
                        "sell_lot": int(sell_lot),
                        "sell_value": round(sell_value, 2),
                        "sell_avg_price": round(sell_avg, 0),
                        "net_lot": int(net_lot),
                        "net_value": round(net_value, 2),
                        "cumulative_net_lot": int(cumulative_net_lot),
                        "cumulative_net_value": round(cumulative_net_value, 2)
                    })
                
                # Calculate summary statistics
                total_buy_lot = sum(d['buy_lot'] for d in daily_data)
                total_buy_value = sum(d['buy_value'] for d in daily_data)
                total_sell_lot = sum(d['sell_lot'] for d in daily_data)
                total_sell_value = sum(d['sell_value'] for d in daily_data)
                
                summary = {
                    "total_buy_lot": int(total_buy_lot),
                    "total_buy_value": round(float(total_buy_value), 2),
                    "total_sell_lot": int(total_sell_lot),
                    "total_sell_value": round(float(total_sell_value), 2),
                    "net_lot": int(cumulative_net_lot),
                    "net_value": round(float(cumulative_net_value), 2),
                    "avg_buy_price": round(total_buy_value / (total_buy_lot / 100) if total_buy_lot > 0 else 0, 0),
                    "avg_sell_price": round(total_sell_value / (total_sell_lot / 100) if total_sell_lot > 0 else 0, 0),
                    "days_active": len(daily_data),
                    "is_accumulating": bool(cumulative_net_value > 0)  # Convert numpy.bool to Python bool
                }
                
                broker_results.append({
                    "broker_code": broker_code.upper(),
                    "daily_data": daily_data,
                    "summary": summary
                })
            
            return {
                "ticker": ticker,
                "date_range": {"start": start_date, "end": end_date},
                "brokers": broker_results,
                "price_data": price_data
            }
        finally:
            conn.close()

    
    def get_top_holders_by_net_lot(
        self,
        ticker: str,
        limit: int = 3
    ) -> List[Dict]:
        """
        Get top holders based on cumulative net lot across all dates.
        
        Args:
            ticker: Stock ticker symbol
            limit: Number of top holders to return (default 3)
        
        Returns:
            List of dictionaries with broker_code, total_net_lot, total_net_value,
            trade_count, first_date, last_date
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT 
                broker,
                SUM(CASE WHEN side='BUY' THEN nlot ELSE -nlot END) as total_net_lot,
                SUM(CASE WHEN side='BUY' THEN nval ELSE -nval END) as total_net_value,
                COUNT(DISTINCT trade_date) as trade_count,
                MIN(trade_date) as first_date,
                MAX(trade_date) as last_date
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = UPPER(?)
            GROUP BY broker
            HAVING total_net_lot > 0
            ORDER BY total_net_lot DESC
            LIMIT ?
            """
            
            df = pd.read_sql(query, conn, params=(ticker, limit))
            
            if df.empty:
                return []
            
            # Convert to list of dicts with proper formatting
            result = []
            for _, row in df.iterrows():
                result.append({
                    'broker_code': row['broker'],
                    'total_net_lot': int(row['total_net_lot']),
                    'total_net_value': round(float(row['total_net_value']), 2),
                    'trade_count': int(row['trade_count']),
                    'first_date': row['first_date'],
                    'last_date': row['last_date']
                })
            
            return result
        finally:
            conn.close()
    
    def get_floor_price_analysis(self, ticker: str, days: int = 30) -> Dict:
        """
        Calculate floor price estimate based on institutional broker buy prices.
        
        Floor Price = Weighted average of buy prices for institutional brokers.
        
        Args:
            ticker: Stock ticker symbol
            days: Number of days to analyze (default 30)
        
        Returns:
            Dict with floor_price, confidence, and breakdown by broker
        """
        import os
        import config
        
        conn = self._get_conn()
        try:
            # Load broker classification
            broker_file = os.path.join(config.DATA_DIR, "brokers_idx.json")
            with open(broker_file, 'r', encoding='utf-8') as f:
                broker_data = json.load(f)
            
            # Build category lookup
            broker_categories = {}
            for broker in broker_data.get('brokers', []):
                code = broker.get('code', '')
                categories = broker.get('category', ['unknown'])
                broker_categories[code] = categories
            
            # Get broker summary data for the ticker over the date range
            # If days=0, get all available data
            if days == 0:
                query = """
                SELECT broker, nlot, nval, avg_price, trade_date
                FROM neobdm_broker_summaries
                WHERE UPPER(ticker) = UPPER(?) AND side = 'BUY'
                ORDER BY trade_date DESC
                """
                params = (ticker,)
            else:
                query = """
                SELECT broker, nlot, nval, avg_price, trade_date
                FROM neobdm_broker_summaries
                WHERE UPPER(ticker) = UPPER(?) AND side = 'BUY'
                  AND trade_date >= date('now', ?)
                ORDER BY trade_date DESC
                """
                params = (ticker, f'-{days} days')
            df = pd.read_sql(query, conn, params=params)
            
            if df.empty:
                return {
                    "ticker": ticker.upper(),
                    "floor_price": 0,
                    "confidence": "NO_DATA",
                    "institutional_buy_value": 0,
                    "institutional_buy_lot": 0,
                    "institutional_brokers": [],
                    "foreign_brokers": [],
                    "days_analyzed": 0,
                    "latest_date": None
                }
            
            # Calculate institutional and foreign broker statistics
            institutional_value = 0
            institutional_lot = 0
            foreign_value = 0
            foreign_lot = 0
            
            institutional_brokers = {}
            foreign_brokers = {}
            
            for _, row in df.iterrows():
                broker_code = row['broker']
                nlot = float(row['nlot']) if row['nlot'] else 0
                nval = float(row['nval']) if row['nval'] else 0  # Value in billions
                avg_price = float(row['avg_price']) if row['avg_price'] else 0
                
                categories = broker_categories.get(broker_code, ['unknown'])
                
                if 'institutional' in categories:
                    institutional_value += nval
                    institutional_lot += nlot
                    
                    if broker_code not in institutional_brokers:
                        institutional_brokers[broker_code] = {
                            'code': broker_code,
                            'total_lot': 0,
                            'total_value': 0,
                            'avg_price': 0,
                            'trade_count': 0
                        }
                    institutional_brokers[broker_code]['total_lot'] += nlot
                    institutional_brokers[broker_code]['total_value'] += nval
                    institutional_brokers[broker_code]['trade_count'] += 1
                    
                if 'foreign' in categories:
                    foreign_value += nval
                    foreign_lot += nlot
                    
                    if broker_code not in foreign_brokers:
                        foreign_brokers[broker_code] = {
                            'code': broker_code,
                            'total_lot': 0,
                            'total_value': 0,
                            'avg_price': 0,
                            'trade_count': 0
                        }
                    foreign_brokers[broker_code]['total_lot'] += nlot
                    foreign_brokers[broker_code]['total_value'] += nval
                    foreign_brokers[broker_code]['trade_count'] += 1
            
            # Calculate average prices for each broker
            for broker_data_item in institutional_brokers.values():
                if broker_data_item['total_lot'] > 0:
                    # Value is in billions, lot is in lot (100 shares per lot)
                    # avg_price = (value * 1e9) / (lot * 100)
                    broker_data_item['avg_price'] = round(
                        (broker_data_item['total_value'] * 1e9) / (broker_data_item['total_lot'] * 100), 0
                    )
            
            for broker_data_item in foreign_brokers.values():
                if broker_data_item['total_lot'] > 0:
                    broker_data_item['avg_price'] = round(
                        (broker_data_item['total_value'] * 1e9) / (broker_data_item['total_lot'] * 100), 0
                    )
            
            # Calculate floor price (weighted average of institutional buy prices)
            floor_price = 0
            if institutional_lot > 0:
                # Value is in billions, lot is in lot (100 shares per lot)
                floor_price = round((institutional_value * 1e9) / (institutional_lot * 100), 0)
            
            # Determine confidence level
            unique_dates = df['trade_date'].nunique()
            if institutional_lot == 0:
                confidence = "NO_DATA"
            elif unique_dates >= 10 and institutional_lot > 10000:
                confidence = "HIGH"
            elif unique_dates >= 5 and institutional_lot > 5000:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
            
            # Sort and limit broker lists
            inst_broker_list = sorted(
                list(institutional_brokers.values()), 
                key=lambda x: x['total_lot'], 
                reverse=True
            )[:10]
            
            foreign_broker_list = sorted(
                list(foreign_brokers.values()), 
                key=lambda x: x['total_lot'], 
                reverse=True
            )[:10]
            
            return {
                "ticker": ticker.upper(),
                "floor_price": int(floor_price),
                "confidence": confidence,
                "institutional_buy_value": round(institutional_value, 2),
                "institutional_buy_lot": int(institutional_lot),
                "foreign_buy_value": round(foreign_value, 2),
                "foreign_buy_lot": int(foreign_lot),
                "institutional_brokers": inst_broker_list,
                "foreign_brokers": foreign_broker_list,
                "days_analyzed": unique_dates,
                "latest_date": df['trade_date'].max() if not df.empty else None
            }
        except Exception as e:
            print(f"[!] Error analyzing floor price: {e}")
            return {
                "ticker": ticker.upper(),
                "floor_price": 0,
                "confidence": "ERROR",
                "institutional_buy_value": 0,
                "institutional_buy_lot": 0,
                "institutional_brokers": [],
                "foreign_brokers": [],
                "days_analyzed": 0,
                "latest_date": None,
                "error": str(e)
            }
        finally:
            conn.close()
    
    def get_neobdm_summaries(
        self,
        method: Optional[str] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Fetch historical NeoBDM summaries (supports both legacy and structured formats).
        
        Args:
            method: Analysis method filter
            period: Time period filter
            start_date: Start date filter
            end_date: End date filter
        
        Returns:
            Pandas DataFrame with summaries
        """
        conn = self._get_conn()
        try:
            # Try structured first
            query_latest = "SELECT scraped_at FROM neobdm_records WHERE 1=1"
            params = []
            
            if method:
                query_latest += " AND method = ?"
                params.append(method)
            if period:
                query_latest += " AND period = ?"
                params.append(period)
            if start_date:
                query_latest += " AND date(scraped_at) >= date(?)"
                params.append(start_date)
            if end_date:
                query_latest += " AND date(scraped_at) <= date(?)"
                params.append(end_date)
            
            query_latest += " ORDER BY scraped_at DESC LIMIT 1"
            cursor = conn.cursor()
            cursor.execute(query_latest, params)
            latest_row = cursor.fetchone()
            
            if latest_row:
                scraped_at = latest_row[0]
                # Fetch all records for this latest scrape
                query_data = """
                SELECT * FROM neobdm_records 
                WHERE scraped_at = ? AND method = ? AND period = ?
                GROUP BY symbol
                ORDER BY symbol ASC
                """
                df = pd.read_sql(query_data, conn, params=(scraped_at, method, period))
                
                # Convert to expected format
                data_list = []
                for _, row in df.iterrows():
                    item = {
                        "symbol": row['symbol'],
                        "pinky": row['pinky'],
                        "crossing": row['crossing'],
                        "likuid": row['likuid'],
                        "unusual": row['unusual'],
                        "price": row['price'],
                        ">ma5": row['ma5'],
                        ">ma10": row['ma10'],
                        ">ma20": row['ma20'],
                        ">ma50": row['ma50'],
                        ">ma100": row['ma100']
                    }
                    if period == 'd':
                        item.update({
                            "w-4": row['w_4'], "w-3": row['w_3'], "w-2": row['w_2'], "w-1": row['w_1'],
                            "d-4": row['d_4'], "d-3": row['d_3'], "d-2": row['d_2'], "d-0": row['d_0'],
                            "%1d": row['pct_1d']
                        })
                    else:
                        item.update({
                            "c-20": row['c_20'], "c-10": row['c_10'], "c-5": row['c_5'], "c-3": row['c_3'],
                            "%3d": row['pct_3d'], "%5d": row['pct_5d'], "%10d": row['pct_10d'], "%20d": row['pct_20d']
                        })
                    data_list.append(item)
                
                return pd.DataFrame([{"scraped_at": scraped_at, "data_json": json.dumps(data_list)}])

            # Fallback to legacy
            query = "SELECT * FROM neobdm_summaries WHERE 1=1"
            params = []
            if method:
                query += " AND method = ?"
                params.append(method)
            if period:
                query += " AND period = ?"
                params.append(period)
            if start_date:
                query += " AND date(scraped_at) >= date(?)"
                params.append(start_date)
            if end_date:
                query += " AND date(scraped_at) <= date(?)"
                params.append(end_date)
            
            query += " ORDER BY scraped_at DESC"
            return pd.read_sql(query, conn, params=params)
        finally:
            conn.close()
    
    def get_available_neobdm_dates(self) -> List[str]:
        """
        Get list of distinct dates available in neobdm_records.
        
        Returns:
            List of date strings (YYYY-MM-DD)
        """
        conn = self._get_conn()
        try:
            query = "SELECT DISTINCT substr(scraped_at, 1, 10) as scrape_date FROM neobdm_records ORDER BY scrape_date DESC"
            df = pd.read_sql(query, conn)
            return df['scrape_date'].astype(str).tolist()
        finally:
            conn.close()
    
    def _get_trading_date(self, base_date_str: str, days_back: int) -> str:
        """
        Calculate trading date going back N days, accounting for weekends.
        
        Args:
            base_date_str: Base date in 'YYYY-MM-DD' format
            days_back: Number of days to go back
        
        Returns:
            Date string in 'YYYY-MM-DD' format
        """
        from datetime import datetime, timedelta
        
        try:
            base = datetime.strptime(base_date_str, '%Y-%m-%d')
        except:
            base = datetime.now()
        
        target = base - timedelta(days=days_back)
        
        # Adjust for weekends
        while target.weekday() >= 5:  # Saturday=5, Sunday=6
            target -= timedelta(days=1)
        
        return target.strftime('%Y-%m-%d')
    
    def _parse_numeric(self, value) -> float:
        """
        Safely parse numeric value with fallback.
        
        Args:
            value: Value to parse (string, number, or None)
        
        Returns:
            Float value or 0.0 if invalid
        """
        if value is None or value == '' or value == '0':
            return 0.0
        
        try:
            val_str = str(value).split('|')[0].replace(',', '').replace('B', '').strip()
            return float(val_str) if val_str else 0.0
        except (ValueError, AttributeError):
            return 0.0
    
    def _get_historical_flow_baseline(self, symbol: str, current_scraped_at: str) -> tuple:
        """
        Calculate historical flow baseline for anomaly detection.
        Returns (mean, std_dev) based on last 30 days of d_0 flows.
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT d_0 
            FROM neobdm_records 
            WHERE symbol = ? 
              AND method = 'm' 
              AND period = 'c'
              AND scraped_at < ?
            ORDER BY scraped_at DESC 
            LIMIT 30
            """
            cursor = conn.cursor()
            cursor.execute(query, (symbol, current_scraped_at))
            rows = cursor.fetchall()
            
            if len(rows) < 5:  # Need minimum 5 data points
                return 0.0, 0.0
            
            flows = [self._parse_numeric(row[0]) for row in rows]
            
            # Calculate statistics
            mean_flow = sum(flows) / len(flows)
            variance = sum((x - mean_flow) ** 2 for x in flows) / len(flows)
            std_dev = variance ** 0.5
            
            return mean_flow, std_dev
        finally:
            conn.close()
    
    def _calculate_price_multiplier(self, price: float) -> float:
        """
        Calculate price-based adjustment multiplier.
        Lower price = higher multiplier (likely smaller market cap).
        """
        if price < 100:
            return 5.0    # Gorengan / Lapis 3
        elif price < 500:
            return 2.5    # Lapis 2
        elif price < 2000:
            return 1.0    # Lapis 1 bawah
        else:
            return 0.5    # Blue Chips
    
    def _calculate_relative_flow_score(self, symbol: str, current_flow: float, 
                                       price: float, scraped_at: str) -> tuple:
        """
        Hybrid Relative Flow Scoring.
        
        Combines:
        1. Historical Z-Score (Statistical Anomaly Detection)
        2. Price-Based Multiplier (Market Cap Proxy)
        
        Returns:
            (relative_score, status, z_score)
        """
        # Layer 1: Historical Anomaly Detection
        mean_flow, std_dev = self._get_historical_flow_baseline(symbol, scraped_at)
        
        if std_dev == 0 or mean_flow == 0:
            # Not enough historical data or no variance
            z_score = 0
            base_score = 0
            status = "INSUFFICIENT_DATA"
        else:
            # Calculate Z-Score
            z_score = (current_flow - mean_flow) / std_dev
            
            # Scoring based on Z-Score
            if z_score > 3.0:
                base_score = 50
                status = "EXTREME_ANOMALY"
            elif z_score > 2.0:
                base_score = 30
                status = "STRONG_ANOMALY"
            elif z_score > 1.0:
                base_score = 15
                status = "MODERATE_ANOMALY"
            elif z_score > -1.0:
                base_score = 0
                status = "NORMAL"
            elif z_score > -2.0:
                base_score = -15
                status = "WEAK_FLOW"
            else:
                base_score = -30
                status = "DISTRIBUTION_ANOMALY"
        
        # Layer 2: Price Adjustment
        price_multiplier = self._calculate_price_multiplier(price)
        
        # Final Relative Score
        relative_score = int(base_score * price_multiplier)
        
        return relative_score, status, round(z_score, 2)
    
    def get_neobdm_history(
        self,
        symbol: str,
        method: str = 'm',
        period: str = 'c',
        limit: int = 30
    ) -> List[Dict]:
        """
        Fetch historical records and decompose cumulative data into daily flows.
        
        **COMPLETE IMPLEMENTATION** with:
        - Daily flow decomposition from cumulative values
        - Price data integration via yfinance
        - Net flow trend calculation
        - Marker tracking over time
        
        Args:
            symbol: Stock symbol
            method: Analysis method ('m', 'nr', 'f')
            period: Time period ('c' for cumulative, 'd' for daily)
            limit: Number of days to return
        
        Returns:
            List of historical data dictionaries with daily breakdown
        """
        conn = self._get_conn()
        try:
            # 1. Fetch historical records
            query = """
            SELECT scraped_at, symbol, pinky, crossing, unusual, likuid,
                   d_0, d_2, d_3, d_4,
                   w_1, w_2,
                   c_3, c_5, c_10, c_20,
                   price, pct_1d, period
            FROM neobdm_records 
            WHERE UPPER(symbol) = UPPER(?)
            AND (method = ? AND (period = ? OR period = 'd'))
            ORDER BY scraped_at DESC, period ASC
            LIMIT ?
            """
            # Fetch loose limit to handle duplicates
            df = pd.read_sql(query, conn, params=(symbol, method, period, limit * 4))
            
            if df.empty:
                return []
            
            # 2. Process each record and decompose flows
            history_dict = {}  # Key: date, Value: data
            
            # Sort order in SQL (period ASC) means 'c' comes before 'd'? 
            # No, 'c' < 'd'. So 'c' is first.
            # We iterate and assign. If duplicate date comes later (e.g. 'd' after 'c'), does it overwrite?
            # We want 'c' to win.
            # If we want 'c' to win, we should process 'd' first then 'c', OR check if exists.
            
            # Let's handle deduplication explicitly
            # Scraped_at DESC means typically newest date first. 
            # Within same date, period ASC means 'c' first, 'd' second.
            
            for _, row in df.iterrows():
                scraped_date = row['scraped_at'][:10]  # Extract date part
                
                # If date already exists, check if we should overwrite
                # We prefer the requested 'period' (usually 'c').
                # Since SQL sorts period ASC ('c' then 'd'), 'c' comes first.
                # So if we see a duplicate date from 'd', we SKIP it.
                if scraped_date in history_dict:
                    continue
                
                # Parse cumulative values
                c3 = self._parse_numeric(row['c_3'])
                c5 = self._parse_numeric(row['c_5'])
                c10 = self._parse_numeric(row['c_10'])
                c20 = self._parse_numeric(row['c_20'])
                
                # Parse daily values
                d0 = self._parse_numeric(row['d_0'])
                d2 = self._parse_numeric(row['d_2'])
                d3 = self._parse_numeric(row['d_3'])
                d4 = self._parse_numeric(row['d_4'])
                
                # Decompose cumulative into daily estimates
                # c-3 covers last 3 days, so average per day
                if c3 != 0:
                    flow_estimate = c3 / 3
                elif c5 != 0:
                    flow_estimate = c5 / 5
                elif c10 != 0:
                    flow_estimate = c10 / 10
                elif d0 != 0:
                    flow_estimate = d0
                else:
                    flow_estimate = 0
                
                # Store decomposed data
                if scraped_date not in history_dict:
                    history_dict[scraped_date] = {
                        'scraped_at': scraped_date,  # Match frontend key
                        'date': scraped_date,        # Keep for compatibility
                        'flow_d0': d0,
                        'flow_d2': d2,
                        'flow_w1': self._parse_numeric(row['w_1']),
                        'flow_c3': c3,
                        'flow_c5': c5,
                        'flow_c10': c10,
                        'flow_c20': c20,
                        'flow': flow_estimate,      # Generic flow field
                        'activeFlow': flow_estimate, # Extra compatibility
                        'price': self._parse_numeric(row['price']),
                        'pct_change': self._parse_numeric(row['pct_1d']), # Match frontend key
                        'change': self._parse_numeric(row['pct_1d']),     # Keep for compatibility
                        'pinky': row['pinky'] if row['pinky'] not in ('x', '0', '') else None,
                        'crossing': row['crossing'] if row['crossing'] not in ('x', '0', '') else None,
                        'unusual': row['unusual'] if row['unusual'] not in ('x', '0', '') else None
                    }
            
            # 3. Convert to sorted list
            history_list = sorted(history_dict.values(), key=lambda x: x['date'], reverse=True)
            
            # 4. Calculate net flow trend
            total_positive = sum(h['flow_d0'] for h in history_list if h['flow_d0'] > 0)
            total_negative = sum(h['flow_d0'] for h in history_list if h['flow_d0'] < 0)
            net_flow = total_positive + total_negative
            
            # 5. Determine trend
            if net_flow > 500:
                trend = "ACCUMULATING"
            elif net_flow > 100:
                trend = "INCREASING"
            elif net_flow > -100:
                trend = "SIDEWAYS"
            elif net_flow > -500:
                trend = "DECLINING"
            else:
                trend = "DISTRIBUTING"
            
            # 6. Add net_flow and trend to each record
            # 6. Add net_flow and trend to each record
            for i in range(len(history_list)):
                record = history_list[i]
                record['net_flow'] = net_flow
                record['trend'] = trend
                
                # 6.1 Calculate Price Change (Nominal & Percentage)
                # We need the next record (which is older because history_list is sorted DESC)
                if i < len(history_list) - 1:
                    curr_price = record.get('price', 0)
                    prev_price = history_list[i+1].get('price', 0)
                    
                    if curr_price and prev_price:
                        # Nominal Change (Price - PrevPrice)
                        nominal_change = curr_price - prev_price
                        record['change'] = nominal_change # Fix: Now storing nominal change
                        
                        # Percentage Change (if missing or 0)
                        if not record.get('pct_change') or record['pct_change'] == 0:
                            calc_pct = (nominal_change / prev_price) * 100
                            record['pct_change'] = round(calc_pct, 2)
                    elif record.get('change'): 
                         # If we can't calculate but have 'change' from DB (which was pct_1d), 
                         # we might want to keep it or zero it if we strictly want nominal.
                         # Since DB stores pct_1d as 'change' initially in line 519, we should probably NULL it 
                         # if we can't verify it's nominal? 
                         # Actually, line 519 maps 'pct_1d' to 'change'. That is WRONG semantic. 
                         # We should rely on calculation. If no prev price, change is 0.
                         record['change'] = 0.0
                else:
                    # Last record (oldest) has no previous price to compare
                    record['change'] = 0.0
            
            # 7. Return limited results
            return history_list[:limit]
            
        finally:
            conn.close()
    
    def get_neobdm_tickers(self) -> List[str]:
        """
        Get list of all unique tickers in NeoBDM data.
        
        Returns:
            Sorted list of ticker symbols
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT UPPER(symbol) as ticker FROM neobdm_records ORDER BY ticker")
            rows = cursor.fetchall()
            return [row[0] for row in rows if row[0]]
        finally:
            conn.close()
    
    # ==================== SCORING SYSTEM ====================
    # Helper methods and multi-phase signal analysis
    
    def _parse_flow_value(self, value) -> float:
        """
        Parse flow value from string format.
        
        Handles formats like: '150.5', '150.5B', '1,234.5', empty, None
        
        Args:
            value: Flow value (string or numeric)
        
        Returns:
            Float value, 0 if invalid
        """
        if value is None or value == '' or value == '0':
            return 0.0
        
        try:
            val_str = str(value).split('|')[0].replace(',', '').replace('B', '').strip()
            return float(val_str) if val_str else 0.0
        except (ValueError, AttributeError):
            return 0.0
    
    def _is_eligible_for_scoring(self, record) -> bool:
        """
        Pre-filter: Only LIQUID stocks, exclude PINKY (repo risk).
        
        Args:
            record: Stock record dictionary
        
        Returns:
            True if eligible for scoring
        """
        likuid = str(record.get('likuid', '')).lower()
        pinky = str(record.get('pinky', '')).lower()
        
        # Must be liquid
        if likuid != 'v':
            return False
        
        # Must NOT be pinky (repo risk)
        if pinky == 'v':
            return False
        
        return True
    
    def _calculate_timeframe_alignment(self, record) -> tuple:
        """
        Phase 1: Timeframe Alignment
        
        Validates signals across Daily, Weekly, and Cumulative timeframes.
        Confluence across multiple timeframes = higher confidence.
        
        Args:
            record: Stock record with flow data
        
        Returns:
            (alignment_score, alignment_status, details_dict)
        """
        # Parse flow values
        d0 = self._parse_flow_value(record.get('d_0', 0))
        w1 = self._parse_flow_value(record.get('w_1', 0))
        c10 = self._parse_flow_value(record.get('c_10', 0))
        
        # Count positive timeframes
        positive_count = sum([d0 > 0, w1 > 0, c10 > 0])
        
        # Identify which timeframes are positive
        positive_tfs = []
        if d0 > 0:
            positive_tfs.append('D')
        if w1 > 0:
            positive_tfs.append('W')
        if c10 > 0:
            positive_tfs.append('C')
        
        # Scoring logic
        if positive_count == 3:
            alignment_score = 30
            alignment_status = "PERFECT_ALIGNMENT"
            label = "✓✓✓"
        elif positive_count == 2:
            alignment_score = 15
            alignment_status = "PARTIAL_ALIGNMENT"
            label = "✓✓"
        elif positive_count == 1:
            alignment_score = 0
            alignment_status = "WEAK_ALIGNMENT"
            label = "✓"
        else:
            alignment_score = -10
            alignment_status = "NO_ALIGNMENT"
            label = "✗"
        
        details = {
            'label': label,
            'positive_timeframes': '+'.join(positive_tfs) if positive_tfs else 'None',
            'd0': d0,
            'w1': w1,
            'c10': c10
        }
        
        return alignment_score, alignment_status, details
    
    def _calculate_momentum(self, record) -> tuple:
        """
        Phase 2: Momentum Analysis
        
        Detects acceleration/deceleration in money flow for better entry timing.
        Analyzes rate of change and trend direction.
        
        Args:
            record: Stock record with flow data
        
        Returns:
            (momentum_score, momentum_status, details_dict)
        """
        # Parse flow values
        d0 = self._parse_flow_value(record.get('d_0', 0))
        d2 = self._parse_flow_value(record.get('d_2', 0))
        d3 = self._parse_flow_value(record.get('d_3', 0))
        w1 = self._parse_flow_value(record.get('w_1', 0))
        w2 = self._parse_flow_value(record.get('w_2', 0))
        
        # 1. Flow Velocity (rate of change)
        if d2 != 0:
            velocity = ((d0 - d2) / abs(d2)) * 100
        else:
            velocity = 100 if d0 > 0 else -100 if d0 < 0 else 0
        
        # 2. Flow Acceleration (change in velocity)
        vel_d0_d2 = d0 - d2
        vel_d2_d3 = d2 - d3
        acceleration = vel_d0_d2 - vel_d2_d3
        
        # 3. Weekly Trend
        if w2 != 0:
            weekly_trend = ((w1 - w2) / abs(w2)) * 100
        else:
            weekly_trend = 100 if w1 > 0 else -100 if w1 < 0 else 0
        
        # 4. Scoring Logic
        momentum_score = 0
        
        # Accelerating (best case)
        if acceleration > 20 and velocity > 30:
            momentum_score = 30
            momentum_status = "ACCELERATING"
            momentum_icon = "🚀"
        # Increasing
        elif velocity > 15:
            momentum_score = 20
            momentum_status = "INCREASING"
            momentum_icon = "↗️"
        # Stable
        elif velocity > 0:
            momentum_score = 10
            momentum_status = "STABLE"
            momentum_icon = "➡️"
        # Weakening
        elif velocity > -15:
            momentum_score = -10
            momentum_status = "WEAKENING"
            momentum_icon = "↘️"
        # Declining (worst case)
        else:
            momentum_score = -20
            momentum_status = "DECLINING"
            momentum_icon = "🔻"
        
        # Weekly trend bonus/penalty
        if weekly_trend > 20:
            momentum_score += 10  # Strong weekly momentum
        elif weekly_trend < -20:
            momentum_score -= 10  # Weak weekly momentum
        
        details = {
            'velocity': round(velocity, 1),
            'acceleration': round(acceleration, 1),
            'weekly_trend': round(weekly_trend, 1),
            'icon': momentum_icon,
            'd0': d0,
            'd2': d2,
            'w1': w1,
            'w2': w2
        }
        
        return momentum_score, momentum_status, details
    
    def _detect_warnings(self, record, momentum_details) -> tuple:
        """
        Phase 3: Early Warning System
        
        Detects weakening signals before full reversal for proactive risk management.
        Three warning levels: Yellow (caution), Orange (warning), Red (high risk).
        
        Args:
            record: Stock record
            momentum_details: Output from _calculate_momentum
        
        Returns:
            (warning_penalty, warning_status, warnings_list)
        """
        warnings = []
        
        # Get momentum data
        d0 = momentum_details['d0']
        d2 = momentum_details['d2']
        w1 = momentum_details['w1']
        w2 = momentum_details['w2']
        velocity = momentum_details['velocity']
        
        # Parse cumulative values
        c3 = self._parse_flow_value(record.get('c_3', 0))
        c10 = self._parse_flow_value(record.get('c_10', 0))
        
        # WARNING 1: Yellow Flag - Velocity Slowdown
        if d0 > 0 and d2 > 0 and d0 < d2:
            warnings.append({
                'level': 'YELLOW',
                'icon': '🟡',
                'message': 'Momentum slowing',
                'severity': 1
            })
        
        # WARNING 2: Orange Flag - Weekly Divergence
        if d0 > 0 and w1 < w2:
            warnings.append({
                'level': 'ORANGE',
                'icon': '🟠',
                'message': 'Weekly reversal',
                'severity': 2
            })
        
        # WARNING 3: Red Flag - Cumulative Decay / Unsustained Spike
        if c3 > 0 and c10 <= 0:
            warnings.append({
                'level': 'RED',
                'icon': '🔴',
                'message': 'Unsustained spike',
                'severity': 3
            })
        
        # Additional Red Flag: Negative velocity with positive flow
        if d0 > 0 and velocity < -10:
            warnings.append({
                'level': 'RED',
                'icon': '🔴',
                'message': 'Negative velocity',
                'severity': 3
            })
        
        # Calculate penalty based on highest severity
        if any(w['level'] == 'RED' for w in warnings):
            penalty = -30
            warning_status = "HIGH_RISK"
        elif any(w['level'] == 'ORANGE' for w in warnings):
            penalty = -15
            warning_status = "WARNING"
        elif any(w['level'] == 'YELLOW' for w in warnings):
            penalty = -5
            warning_status = "CAUTION"
        else:
            penalty = 0
            warning_status = "NO_WARNINGS"
        
        return penalty, warning_status, warnings
    
    def _detect_patterns(self, record, momentum_details) -> tuple:
        """
        Phase 4: Pattern Recognition
        
        Identifies 6 key flow patterns to distinguish smart money vs dumb money.
        Patterns reveal underlying accumulation/distribution behavior.
        
        Args:
            record: Stock record
            momentum_details: Output from _calculate_momentum
        
        Returns:
            (pattern_score, patterns_list)
        """
        patterns = []
        total_score = 0
        
        # Get flow values
        d0 = momentum_details['d0']
        d2 = momentum_details['d2']
        w1 = momentum_details['w1']
        w2 = momentum_details['w2']
        
        # Parse additional daily flows
        d3 = self._parse_flow_value(record.get('d_3', 0))
        d4 = self._parse_flow_value(record.get('d_4', 0))
        
        # Parse cumulative values
        c3 = self._parse_flow_value(record.get('c_3', 0))
        c5 = self._parse_flow_value(record.get('c_5', 0))
        c10 = self._parse_flow_value(record.get('c_10', 0))
        c20 = self._parse_flow_value(record.get('c_20', 0))
        
        # PATTERN 1: Consistent Accumulation (Best)
        if all([d0 > 0, d2 > 0, d3 > 0, d4 > 0]) and c20 > c10 > c3:
            patterns.append({
                'name': 'CONSISTENT_ACCUMULATION',
                'display': '✅ Consistent Accumulation',
                'score': 40,
                'icon': '✅'
            })
            total_score += 40
        
        # PATTERN 2: Sudden Spike (Risky)
        if d0 > 150 and c10 < 200:
            patterns.append({
                'name': 'SUDDEN_SPIKE',
                'display': '⚡ Sudden Spike',
                'score': -15,
                'icon': '⚡'
            })
            total_score -= 15
        
        # PATTERN 3: Trend Reversal (Opportunity)
        if w2 < 0 and w1 > 0 and d0 > 100:
            patterns.append({
                'name': 'TREND_REVERSAL',
                'display': '🔄 Trend Reversal',
                'score': 25,
                'icon': '🔄'
            })
            total_score += 25
        
        # PATTERN 4: Distribution (Avoid)
        if all([d0 < 0, d2 < 0, d3 < 0]):
            patterns.append({
                'name': 'DISTRIBUTION',
                'display': '❌ Distribution',
                'score': -40,
                'icon': '❌'
            })
            total_score -= 40
        
        # PATTERN 5: Sideways Accumulation (Good)
        velocity = momentum_details.get('velocity', 0)
        if c20 > 300 and -20 < velocity < 20:
            patterns.append({
                'name': 'SIDEWAYS_ACCUMULATION',
                'display': '📊 Sideways Accumulation',
                'score': 20,
                'icon': '📊'
            })
            total_score += 20
        
        # PATTERN 6: Accelerating Buildup (Very Strong)
        if d0 > d2 > d3 > d4 and d0 > 50:
            patterns.append({
                'name': 'ACCELERATING_BUILDUP',
                'display': '🚀 Accelerating Build-up',
                'score': 30,
                'icon': '🚀'
            })
            total_score += 30
        
        return total_score, patterns
    
    def _calculate_signal_score(self, record) -> tuple:
        """
        Multi-Factor Signal Scoring System (Orchestrator)
        
        Combines all 4 phases plus base scoring into final signal score.
        
        Components:
        1. Base Marker Score
        2. Flow Magnitude
        3. Price Momentum
        4. Synergy Bonus
        5. Phase 1: Timeframe Alignment
        6. Phase 2: Momentum Analysis
        7. Phase 3: Early Warning
        8. Phase 4: Pattern Recognition
        
        Args:
            record: Complete stock record
        
        Returns:
            Complete scoring tuple with all enrichment data
        """
        score = 0
        
        # 1. Marker Score
        crossing_val = str(record.get('crossing', '')).lower()
        unusual_val = str(record.get('unusual', '')).lower()
        
        if crossing_val == 'v':
            score -= 40  # Distribution pressure
        if unusual_val == 'v':
            score += 15  # Abnormal activity
        
        # 2. Flow Magnitude Score
        try:
            flow_str = str(record.get('d_0', '0')).replace(',', '').replace('B', '').strip()
            flow = float(flow_str) if flow_str else 0
        except:
            flow = 0
        
        if flow > 0:  # Inflow
            if flow > 200:
                score += 50
            elif flow > 100:
                score += 40
            elif flow > 50:
                score += 30
            elif flow > 20:
                score += 20
            elif flow > 5:
                score += 10
            else:
                score += 5
        else:  # Outflow
            abs_flow = abs(flow)
            if abs_flow > 200:
                score -= 50
            elif abs_flow > 100:
                score -= 40
            elif abs_flow > 50:
                score -= 30
            elif abs_flow > 20:
                score -= 20
            elif abs_flow > 5:
                score -= 10
            else:
                score -= 5
        
        # 3. Price Momentum Score
        try:
            pct_change = float(record.get('pct_1d', 0))
        except:
            pct_change = 0
        
        if pct_change > 5:
            score -= 30  # TOO LATE
        elif pct_change > 3:
            score -= 10  # Late entry
        elif pct_change > 1:
            score += 5   # Early momentum
        elif pct_change > -1:
            score += 15  # SWEET SPOT
        elif pct_change > -3:
            score += 10  # Slight dip
        elif pct_change > -5:
            score += 0   # Moderate dip
        else:
            score -= 20  # Falling knife
        
        # 4. Flow-Price Synergy Bonus
        if flow > 100 and pct_change < 3:
            score += 30  # IDEAL: Big inflow, price belum pump
        elif flow > 50 and pct_change < 1:
            score += 20  # Good entry window
        elif flow > 100 and pct_change > 5:
            score -= 20  # FOMO trap
        
        # 5. Phase 1: Timeframe Alignment
        alignment_score, alignment_status, alignment_details = self._calculate_timeframe_alignment(record)
        score += alignment_score
        
        # 6. Phase 2: Momentum Analysis
        momentum_score, momentum_status, momentum_details = self._calculate_momentum(record)
        score += momentum_score
        
        # 7. Phase 3: Early Warning System
        warning_penalty, warning_status, warnings = self._detect_warnings(record, momentum_details)
        score += warning_penalty
        
        # 8. Phase 4: Pattern Recognition
        pattern_score, patterns = self._detect_patterns(record, momentum_details)
        score += pattern_score
        
        # 10. NEW: Multi-Method Confluence Bonus
        confluence_score, confluence_status, confluence_methods = self._calculate_method_confluence(
            record['symbol'], record['scraped_at']
        )
        score += confluence_score
        
        # 11. NEW: Relative Flow Score (Size Bias Correction)
        try:
            price = self._parse_numeric(record.get('price', 0))
            scraped_at = record.get('scraped_at', '')
            relative_score, relative_status, z_score = self._calculate_relative_flow_score(
                record['symbol'], flow, price, scraped_at
            )
            score += relative_score
        except Exception as e:
            # Fallback if relative scoring fails
            relative_score = 0
            relative_status = "ERROR"
            z_score = 0.0
        
        # 9. Determine Strength Label (Final)
        if score >= 150:
            strength = "VERY_STRONG"
        elif score >= 90:
            strength = "STRONG"
        elif score >= 45:
            strength = "MODERATE"
        elif score >= 0:
            strength = "WEAK"
        else:
            strength = "AVOID"
        
        return (score, strength, alignment_status, alignment_details,
                momentum_status, momentum_details, warning_status, warnings, patterns,
                confluence_status, confluence_methods, relative_score, relative_status, z_score)
    
    def get_latest_hot_signals(self) -> List[Dict]:
        """
        Get hot signals with advanced multi-factor scoring.
       
        **COMPLETE IMPLEMENTATION** with 4-phase scoring system:
        - Phase 1: Timeframe Alignment (D+W+C)
        - Phase 2: Momentum Analysis (Velocity/Acceleration)
        - Phase 3: Early Warning (Risk Flags)
        - Phase 4: Pattern Recognition (6 patterns)
        
        Returns:
            List of scored and enriched signal dictionaries
        """
        conn = self._get_conn()
        try:
            # 1. Get latest scrape timestamp for DAILY period (has d_0 and pct_1d data)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MAX(scraped_at) FROM neobdm_records 
                WHERE method='m' AND period='d'
            """)
            latest = cursor.fetchone()[0]
            
            if not latest:
                return []
            
            # 2. Fetch ALL required columns for scoring
            # Use MAX() aggregation with GROUP BY to handle potential duplicates
            query = """
            SELECT symbol, 
                   MAX(pinky) as pinky, 
                   MAX(crossing) as crossing, 
                   MAX(unusual) as unusual, 
                   MAX(likuid) as likuid,
                   MAX(d_0) as d_0, 
                   MAX(d_2) as d_2, 
                   MAX(d_3) as d_3, 
                   MAX(d_4) as d_4,
                   MAX(w_1) as w_1, 
                   MAX(w_2) as w_2,
                   MAX(c_3) as c_3, 
                   MAX(c_5) as c_5, 
                   MAX(c_10) as c_10, 
                   MAX(c_20) as c_20,
                   MAX(price) as price, 
                   MAX(pct_1d) as pct_1d
            FROM neobdm_records
            WHERE scraped_at = ? AND method = 'm' AND period = 'd'
            GROUP BY symbol
            """
            df = pd.read_sql(query, conn, params=(latest,))

            
            if df.empty:
                return []
            
            # 3. Process and score each record
            scored_results = []
            for _, record in df.iterrows():
                # Pre-filter: Only LIQUID & NO PINKY
                if not self._is_eligible_for_scoring(record):
                    continue
                
                # Add scraped_at to record for relative scoring
                record_dict = record.to_dict()
                record_dict['scraped_at'] = latest
                
                # Calculate complete score with all phases + Confluence + Relative
                (score, strength, alignment_status, alignment_details,
                 momentum_status, momentum_details, warning_status,
                 warnings, patterns, confluence_status, confluence_methods,
                 relative_score, relative_status, z_score) = self._calculate_signal_score(record_dict)
                
                # Only include positive or near-positive scores
                if score >= 0:
                    # Sanitized symbol (remove stars)
                    clean_symbol = record["symbol"].replace('★', '').replace('⭐', '').strip()
                    scored_results.append({
                        # Basic fields
                        "symbol": clean_symbol,
                        "pinky": record["pinky"] if record["pinky"] not in ('x','0','') else None,
                        "crossing": record["crossing"] if record["crossing"] not in ('x','0','') else None,
                        "unusual": record["unusual"] if record["unusual"] not in ('x','0','') else None,
                        "flow": self._parse_numeric(record["d_0"]),
                        "price": self._parse_numeric(record["price"]),
                        "change": self._parse_numeric(record["pct_1d"]),
                        
                        # Scoring fields
                        "signal_score": int(score),
                        "signal_strength": strength,
                        
                        # Phase 1: Timeframe Alignment
                        "alignment_status": alignment_status,
                        "alignment_label": alignment_details['label'],
                        "alignment_timeframes": alignment_details['positive_timeframes'],
                        
                        # Phase 2: Momentum Analysis
                        "momentum_status": momentum_status,
                        "momentum_icon": momentum_details['icon'],
                        "momentum_velocity": momentum_details['velocity'],
                        
                        # Phase 3: Early Warning
                        "warning_status": warning_status,
                        "warning_count": len(warnings),
                        "warnings": [{"level": w['level'], "icon": w['icon'], "message": w['message']} for w in warnings],
                        
                        # Phase 4: Pattern Recognition
                        "patterns": [{"name": p['name'], "display": p['display'], "icon": p['icon'], "score": p['score']} for p in patterns],
                        "pattern_count": len(patterns),
                        
                        # NEW: Confluence Data
                        "confluence_status": confluence_status,
                        "confluence_methods": confluence_methods,
                        
                        # NEW: Relative Flow Scoring
                        "relative_score": relative_score,
                        "relative_status": relative_status,
                        "z_score": z_score
                    })
            
            # 4. Sort by score descending
            scored_results.sort(key=lambda x: x["signal_score"], reverse=True)
            
            # 5. Return top 20
            return scored_results[:20]
            
        finally:
            conn.close()
    
    # ==================== VOLUME MANAGEMENT ====================
    # Methods for handling daily volume data with incremental fetching
    
    def save_volume_batch(self, ticker: str, records: List[Dict]):
        """
        Save a batch of volume records for a ticker.
        Uses INSERT OR REPLACE to handle duplicates.
        
        Args:
            ticker: Stock ticker
            records: List of volume records with keys:
                - trade_date: YYYY-MM-DD
                - volume: Trading volume
                - open_price, high_price, low_price, close_price: OHLC data
        """
        conn = self._get_conn()
        try:
            query = """
            INSERT OR REPLACE INTO volume_daily_records (
                ticker, trade_date, volume, open_price, high_price, low_price, close_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            
            rows = []
            for record in records:
                rows.append((
                    ticker.upper(),
                    record['trade_date'],
                    record['volume'],
                    record.get('open_price'),
                    record.get('high_price'),
                    record.get('low_price'),
                    record.get('close_price')
                ))
            
            conn.executemany(query, rows)
            conn.commit()
            print(f"[*] Saved {len(rows)} volume records for {ticker}")
            
        except Exception as e:
            print(f"[!] Error saving volume batch for {ticker}: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_volume_history(
        self, 
        ticker: str, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """
        Get volume history for a ticker within a date range.
        
        Args:
            ticker: Stock ticker
            start_date: Start date (YYYY-MM-DD), optional
            end_date: End date (YYYY-MM-DD), optional
        
        Returns:
            List of volume records sorted by date descending
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT trade_date, volume, open_price, high_price, low_price, close_price
            FROM volume_daily_records
            WHERE UPPER(ticker) = UPPER(?)
            """
            params = [ticker]
            
            if start_date:
                query += " AND trade_date >= ?"
                params.append(start_date)
            
            if end_date:
                query += " AND trade_date <= ?"
                params.append(end_date)
            
            query += " ORDER BY trade_date DESC"
            
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                results.append({
                    'trade_date': row[0],
                    'volume': row[1],
                    'open_price': row[2],
                    'high_price': row[3],
                    'low_price': row[4],
                    'close_price': row[5]
                })
            
            return results
            
        finally:
            conn.close()
    
    def get_latest_volume_date(self, ticker: str) -> Optional[str]:
        """
        Get the latest trade date for which we have volume data.
        
        Args:
            ticker: Stock ticker
        
        Returns:
            Latest trade date (YYYY-MM-DD) or None if no data
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT MAX(trade_date)
            FROM volume_daily_records
            WHERE UPPER(ticker) = UPPER(?)
            """
            cursor = conn.cursor()
            cursor.execute(query, (ticker,))
            row = cursor.fetchone()
            
            return row[0] if row and row[0] else None
            
        finally:
            conn.close()
    
    def get_or_fetch_volume(self, ticker: str) -> Dict:
        """
        Smart volume fetching with incremental updates.
        
        Logic:
        - If ticker has no data: fetch from 2025-12-22 to today
        - If ticker has data: fetch from (latest_date + 1) to today
        - Returns all historical data from database
        
        Args:
            ticker: Stock ticker
        
        Returns:
            {
                "ticker": "BBCA",
                "data": [...],
                "source": "database" or "fetched",
                "records_added": 10
            }
        """
        from modules.volume_fetcher import VolumeFetcher
        
        latest_date = self.get_latest_volume_date(ticker)
        fetcher = VolumeFetcher()
        records_added = 0
        source = "database"
        
        if latest_date is None:
            # First time fetch: get all data from START_DATE
            print(f"[*] First time fetching volume for {ticker} from {fetcher.START_DATE}")
            records = fetcher.get_volume_data(ticker, start_date=fetcher.START_DATE)
            
            if records:
                self.save_volume_batch(ticker, records)
                records_added = len(records)
                source = "fetched_full"
        else:
            # Incremental fetch: only get new data
            next_date = (datetime.strptime(latest_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
            today = datetime.now().strftime('%Y-%m-%d')
            
            if next_date <= today:
                print(f"[*] Incremental fetch for {ticker} from {next_date} to {today}")
                records = fetcher.get_volume_data(ticker, start_date=next_date, end_date=today)
                
                if records:
                    self.save_volume_batch(ticker, records)
                    records_added = len(records)
                    source = "fetched_incremental"
            else:
                print(f"[*] Volume data for {ticker} is up to date (latest: {latest_date})")
        
        # Get all historical data from database
        all_data = self.get_volume_history(ticker, start_date=fetcher.START_DATE)
        
        return {
            "ticker": ticker.upper(),
            "data": all_data,
            "source": source,
            "records_added": records_added
        }
