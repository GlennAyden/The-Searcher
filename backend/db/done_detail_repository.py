"""Done Detail repository for paste-based trade data analysis."""
import pandas as pd
from typing import Optional, List, Dict
from .connection import BaseRepository


class DoneDetailRepository(BaseRepository):
    """Repository for Done Detail records (pasted trade data)."""
    
    def check_exists(self, ticker: str, trade_date: str) -> bool:
        """
        Check if data exists for a ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            True if data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            count = cursor.fetchone()[0]
            return count > 0
        except Exception as e:
            print(f"[!] Error checking done detail exists: {e}")
            return False
        finally:
            conn.close()
    
    def save_records(self, ticker: str, trade_date: str, records: List[Dict]) -> int:
        """
        Save parsed trade records.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
            records: List of trade dictionaries
        
        Returns:
            Number of records saved
        """
        conn = self._get_conn()
        try:
            # Delete existing records for this ticker/date
            conn.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            
            query = """
            INSERT INTO done_detail_records 
            (ticker, trade_date, trade_time, board, price, qty, buyer_type, buyer_code, seller_code, seller_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            rows = []
            for rec in records:
                row = (
                    ticker.upper(),
                    trade_date,
                    rec.get('time'),
                    rec.get('board'),
                    rec.get('price'),
                    rec.get('qty'),
                    rec.get('buyer_type'),
                    rec.get('buyer_code'),
                    rec.get('seller_code'),
                    rec.get('seller_type')
                )
                rows.append(row)
            
            conn.executemany(query, rows)
            conn.commit()
            print(f"[*] Saved {len(rows)} done detail records for {ticker} on {trade_date}")
            return len(rows)
        except Exception as e:
            print(f"[!] Error saving done detail records: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def get_records(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """
        Get records for a specific ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            DataFrame with trade records
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return df
        except Exception as e:
            print(f"[!] Error fetching done detail records: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def get_saved_history(self) -> pd.DataFrame:
        """
        Get all saved ticker/date combinations.
        
        Returns:
            DataFrame with ticker, trade_date, record_count, created_at
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT ticker, trade_date, COUNT(*) as record_count, MAX(created_at) as created_at
            FROM done_detail_records
            GROUP BY ticker, trade_date
            ORDER BY created_at DESC
            """
            df = pd.read_sql(query, conn)
            return df
        except Exception as e:
            print(f"[!] Error fetching done detail history: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def delete_records(self, ticker: str, trade_date: str) -> bool:
        """
        Delete records for a ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            True if successful
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
            deleted = cursor.rowcount
            print(f"[*] Deleted {deleted} done detail records for {ticker} on {trade_date}")
            return deleted > 0
        except Exception as e:
            print(f"[!] Error deleting done detail records: {e}")
            return False
        finally:
            conn.close()
    
    def get_sankey_data(self, ticker: str, trade_date: str) -> Dict:
        """
        Generate Sankey diagram data from trade records.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            Dict with nodes and links for Sankey chart
        """
        conn = self._get_conn()
        try:
            # Aggregate flows between seller -> buyer
            # Note: Use qty * price directly (matching NeoBDM calculation)
            query = """
            SELECT seller_code, buyer_code, 
                   SUM(qty) as total_qty, 
                   SUM(qty * price) as total_value,
                   AVG(price) as avg_price
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            GROUP BY seller_code, buyer_code
            ORDER BY total_qty DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            
            if df.empty:
                return {"nodes": [], "links": []}
            
            # Build unique broker list: sellers on one side, buyers on other
            sellers = df['seller_code'].unique().tolist()
            buyers = df['buyer_code'].unique().tolist()
            
            # Create nodes: sellers first (index 0..n-1), then buyers (index n..m)
            nodes = []
            seller_idx = {}
            buyer_idx = {}
            
            for i, s in enumerate(sellers):
                seller_idx[s] = i
                nodes.append({"name": s, "type": "seller"})
            
            offset = len(sellers)
            for i, b in enumerate(buyers):
                buyer_idx[b] = offset + i
                nodes.append({"name": b, "type": "buyer"})
            
            # Create links
            links = []
            for _, row in df.iterrows():
                links.append({
                    "source": seller_idx[row['seller_code']],
                    "target": buyer_idx[row['buyer_code']],
                    "value": int(row['total_qty']),
                    "lot": int(row['total_qty']),
                    "val": float(row['total_value']) if row['total_value'] else 0,
                    "avgPrice": float(row['avg_price']) if row['avg_price'] else 0
                })
            
            return {"nodes": nodes, "links": links}
        except Exception as e:
            print(f"[!] Error generating sankey data: {e}")
            return {"nodes": [], "links": []}
        finally:
            conn.close()
    
    def get_inventory_data(self, ticker: str, trade_date: str, interval_minutes: int = 1) -> Dict:
        """
        Generate Daily Inventory chart data.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
            interval_minutes: Time interval for aggregation
        
        Returns:
            Dict with time series data per broker
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            
            if df.empty:
                return {"brokers": [], "timeSeries": [], "priceData": []}
            
            # Calculate net position per broker over time
            # For each broker: buy = +qty, sell = -qty
            broker_positions = {}
            time_series = []
            price_data = []
            
            # Get unique brokers
            all_brokers = set(df['buyer_code'].unique()) | set(df['seller_code'].unique())
            for broker in all_brokers:
                broker_positions[broker] = 0
            
            # Process trades chronologically
            current_time = None
            snapshot = {}
            
            for _, row in df.iterrows():
                time = row['trade_time']
                price = row['price']
                qty = row['qty']
                buyer = row['buyer_code']
                seller = row['seller_code']
                
                # Update positions
                broker_positions[buyer] = broker_positions.get(buyer, 0) + qty
                broker_positions[seller] = broker_positions.get(seller, 0) - qty
                
                # Add time point
                if time != current_time:
                    if current_time is not None:
                        time_series.append({"time": current_time, **snapshot.copy()})
                    current_time = time
                    snapshot = {b: broker_positions[b] for b in all_brokers}
                    price_data.append({"time": time, "price": price})
                else:
                    snapshot = {b: broker_positions[b] for b in all_brokers}
            
            # Add final snapshot
            if current_time:
                time_series.append({"time": current_time, **snapshot})
            
            return {
                "brokers": list(all_brokers),
                "timeSeries": time_series,
                "priceData": price_data
            }
        except Exception as e:
            print(f"[!] Error generating inventory data: {e}")
            return {"brokers": [], "timeSeries": [], "priceData": []}
        finally:
            conn.close()
    
    def get_accum_dist_analysis(self, ticker: str, trade_date: str) -> Dict:
        """
        Analyze accumulation/distribution pattern based on broker classification.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            Dict with status (AKUMULASI/DISTRIBUSI/NETRAL) and breakdown by category
        """
        import json
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
            
            # Get all trades for this ticker/date
            query = """
            SELECT buyer_code, seller_code, qty, price
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            
            if df.empty:
                return {
                    "status": "NO_DATA",
                    "retail_net_lot": 0,
                    "institutional_net_lot": 0,
                    "foreign_net_lot": 0,
                    "retail_brokers": [],
                    "institutional_brokers": [],
                    "foreign_brokers": [],
                    "total_volume": 0
                }
            
            # Calculate net lot per broker
            broker_net = {}
            for _, row in df.iterrows():
                buyer = row['buyer_code']
                seller = row['seller_code']
                qty = row['qty']
                
                # Buyer gets positive, seller gets negative
                broker_net[buyer] = broker_net.get(buyer, 0) + qty
                broker_net[seller] = broker_net.get(seller, 0) - qty
            
            # Aggregate by category
            retail_net = 0
            institutional_net = 0
            foreign_net = 0
            
            retail_brokers = []
            institutional_brokers = []
            foreign_brokers = []
            
            for broker_code, net_lot in broker_net.items():
                categories = broker_categories.get(broker_code, ['unknown'])
                
                broker_info = {"code": broker_code, "net_lot": int(net_lot)}
                
                # Check categories (a broker can be in multiple categories)
                if 'retail' in categories:
                    retail_net += net_lot
                    retail_brokers.append(broker_info)
                if 'institutional' in categories:
                    institutional_net += net_lot
                    institutional_brokers.append(broker_info)
                if 'foreign' in categories:
                    foreign_net += net_lot
                    foreign_brokers.append(broker_info)
                
                # If broker has no known category, treat as retail
                if 'unknown' in categories or len(categories) == 0:
                    retail_net += net_lot
                    retail_brokers.append(broker_info)
            
            # Sort brokers by absolute net_lot
            retail_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
            institutional_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
            foreign_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
            
            # Determine status
            # AKUMULASI: Institusi beli (net > 0) dan Retail jual (net < 0)
            # DISTRIBUSI: Institusi jual (net < 0) dan Retail beli (net > 0)
            total_volume = int(df['qty'].sum())
            
            if institutional_net > 0 and retail_net < 0:
                status = "AKUMULASI"
            elif institutional_net < 0 and retail_net > 0:
                status = "DISTRIBUSI"
            else:
                status = "NETRAL"
            
            return {
                "status": status,
                "retail_net_lot": int(retail_net),
                "institutional_net_lot": int(institutional_net),
                "foreign_net_lot": int(foreign_net),
                "retail_brokers": retail_brokers[:10],  # Top 10
                "institutional_brokers": institutional_brokers[:10],
                "foreign_brokers": foreign_brokers[:10],
                "total_volume": total_volume
            }
        except Exception as e:
            print(f"[!] Error analyzing accum/dist: {e}")
            return {
                "status": "ERROR",
                "retail_net_lot": 0,
                "institutional_net_lot": 0,
                "foreign_net_lot": 0,
                "retail_brokers": [],
                "institutional_brokers": [],
                "foreign_brokers": [],
                "total_volume": 0,
                "error": str(e)
            }
        finally:
            conn.close()
    
    def get_available_tickers(self) -> List[str]:
        """
        Get list of unique tickers that have saved Done Detail data.
        
        Returns:
            List of ticker symbols
        """
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT DISTINCT ticker FROM done_detail_records ORDER BY ticker"
            )
            return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"[!] Error fetching available tickers: {e}")
            return []
        finally:
            conn.close()
    
    def get_date_range(self, ticker: str) -> Dict:
        """
        Get available date range for a ticker.
        
        Args:
            ticker: Stock symbol
        
        Returns:
            Dict with min_date, max_date, and list of available dates
        """
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT DISTINCT trade_date 
                FROM done_detail_records 
                WHERE ticker = ? 
                ORDER BY trade_date DESC
                """,
                (ticker.upper(),)
            )
            dates = [row[0] for row in cursor.fetchall()]
            
            if not dates:
                return {"min_date": None, "max_date": None, "dates": []}
            
            return {
                "min_date": min(dates),
                "max_date": max(dates),
                "dates": dates
            }
        except Exception as e:
            print(f"[!] Error fetching date range: {e}")
            return {"min_date": None, "max_date": None, "dates": []}
        finally:
            conn.close()
    
    def get_records_range(self, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Get records for a date range.
        
        Args:
            ticker: Stock symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            DataFrame with trade records
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date DESC, trade_time DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date))
            return df
        except Exception as e:
            print(f"[!] Error fetching records range: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def detect_imposter_trades(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """
        Detect imposter trades using statistical outlier detection.
        
        Imposter = Smart Money using retail broker accounts with abnormally large lot sizes.
        
        Method: Percentile-based detection
        - STRONG IMPOSTER: Lot >= P99 (Top 1%) from retail/mixed broker
        - POSSIBLE IMPOSTER: Lot >= P95 (Top 5%) from retail/mixed broker
        
        Args:
            ticker: Stock symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            Dict with all trades and imposter analysis results
        """
        import json
        import os
        import config
        import numpy as np
        
        conn = self._get_conn()
        try:
            # Load broker classification
            broker_file = os.path.join(config.DATA_DIR, "brokers_idx.json")
            with open(broker_file, 'r', encoding='utf-8') as f:
                broker_data = json.load(f)
            
            # Build broker info lookup
            broker_info = {}
            retail_codes = set()
            mixed_codes = set()
            
            for broker in broker_data.get('brokers', []):
                code = broker.get('code', '')
                categories = broker.get('category', [])
                broker_info[code] = {
                    'name': broker.get('name', code),
                    'categories': categories
                }
                
                # Retail and mixed brokers
                if 'retail' in categories:
                    retail_codes.add(code)
                if 'mixed' in categories or ('retail' in categories and 'institutional' in categories):
                    mixed_codes.add(code)
            
            # Get all transactions in date range
            query = """
            SELECT trade_date, trade_time, price, qty, buyer_type, buyer_code, seller_code, seller_type
            FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date DESC, trade_time DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date))
            
            if df.empty:
                return {
                    "ticker": ticker.upper(),
                    "date_range": {"start": start_date, "end": end_date},
                    "total_transactions": 0,
                    "imposter_count": 0,
                    "thresholds": {"p95": 0, "p99": 0, "median": 0, "mean": 0},
                    "all_trades": [],
                    "imposter_trades": [],
                    "by_broker": [],
                    "summary": {
                        "total_value": 0,
                        "total_lot": 0,
                        "imposter_value": 0,
                        "imposter_lot": 0,
                        "imposter_percentage": 0,
                        "strong_count": 0,
                        "possible_count": 0
                    }
                }
            
            # Calculate percentile thresholds from ALL transactions
            all_qty = df['qty'].values
            p95_threshold = float(np.percentile(all_qty, 95))  # Top 5%
            p99_threshold = float(np.percentile(all_qty, 99))  # Top 1%
            median_lot = float(np.median(all_qty))
            mean_lot = float(np.mean(all_qty))
            
            all_trades = []
            imposter_trades = []
            imposter_broker_stats = {}
            total_value = 0
            total_lot = 0
            imposter_value = 0
            imposter_lot = 0
            strong_count = 0
            possible_count = 0
            
            for _, row in df.iterrows():
                buyer = row['buyer_code']
                seller = row['seller_code']
                qty = int(row['qty'])
                price = float(row['price'])
                value = qty * price * 100  # lot * 100 shares * price
                trade_date = row['trade_date']
                trade_time = row['trade_time']
                
                total_value += value
                total_lot += qty
                
                # Determine if buyer/seller are retail or mixed
                buyer_is_retail_like = buyer in retail_codes or buyer in mixed_codes
                seller_is_retail_like = seller in retail_codes or seller in mixed_codes
                
                # Determine imposter level based on lot size
                def get_imposter_level(lot):
                    if lot >= p99_threshold:
                        return "STRONG"
                    elif lot >= p95_threshold:
                        return "POSSIBLE"
                    return None
                
                # Build trade info
                trade_info = {
                    "trade_date": trade_date,
                    "trade_time": trade_time,
                    "buyer_code": buyer,
                    "buyer_name": broker_info.get(buyer, {}).get('name', buyer),
                    "seller_code": seller,
                    "seller_name": broker_info.get(seller, {}).get('name', seller),
                    "qty": qty,
                    "price": price,
                    "value": value,
                    "is_imposter": False,
                    "imposter_side": None,
                    "imposter_broker": None,
                    "imposter_level": None,
                    "percentile": round((np.searchsorted(np.sort(all_qty), qty) / len(all_qty)) * 100, 1)
                }
                
                # Check if buyer side is imposter
                if buyer_is_retail_like:
                    level = get_imposter_level(qty)
                    if level:
                        trade_info["is_imposter"] = True
                        trade_info["imposter_side"] = "BUY"
                        trade_info["imposter_broker"] = buyer
                        trade_info["imposter_level"] = level
                        
                        imposter_trades.append({
                            "trade_date": trade_date,
                            "trade_time": trade_time,
                            "broker_code": buyer,
                            "broker_name": broker_info.get(buyer, {}).get('name', buyer),
                            "broker_type": "retail" if buyer in retail_codes else "mixed",
                            "direction": "BUY",
                            "qty": qty,
                            "price": price,
                            "value": value,
                            "counterparty": seller,
                            "level": level,
                            "percentile": trade_info["percentile"]
                        })
                        
                        imposter_value += value
                        imposter_lot += qty
                        if level == "STRONG":
                            strong_count += 1
                        else:
                            possible_count += 1
                        
                        if buyer not in imposter_broker_stats:
                            imposter_broker_stats[buyer] = {"count": 0, "total_value": 0, "total_lot": 0, "buy_count": 0, "sell_count": 0, "strong": 0, "possible": 0}
                        imposter_broker_stats[buyer]["count"] += 1
                        imposter_broker_stats[buyer]["buy_count"] += 1
                        imposter_broker_stats[buyer]["total_value"] += value
                        imposter_broker_stats[buyer]["total_lot"] += qty
                        imposter_broker_stats[buyer][level.lower()] += 1
                
                # Check if seller side is imposter
                if seller_is_retail_like:
                    level = get_imposter_level(qty)
                    if level:
                        if trade_info["is_imposter"]:
                            trade_info["imposter_side"] = "BOTH"
                            trade_info["imposter_broker"] = f"{trade_info['imposter_broker']}/{seller}"
                        else:
                            trade_info["is_imposter"] = True
                            trade_info["imposter_side"] = "SELL"
                            trade_info["imposter_broker"] = seller
                            trade_info["imposter_level"] = level
                        
                        imposter_trades.append({
                            "trade_date": trade_date,
                            "trade_time": trade_time,
                            "broker_code": seller,
                            "broker_name": broker_info.get(seller, {}).get('name', seller),
                            "broker_type": "retail" if seller in retail_codes else "mixed",
                            "direction": "SELL",
                            "qty": qty,
                            "price": price,
                            "value": value,
                            "counterparty": buyer,
                            "level": level,
                            "percentile": trade_info["percentile"]
                        })
                        
                        # Only add to total if not already counted
                        if not buyer_is_retail_like or get_imposter_level(qty) is None:
                            imposter_value += value
                            imposter_lot += qty
                            if level == "STRONG":
                                strong_count += 1
                            else:
                                possible_count += 1
                        
                        if seller not in imposter_broker_stats:
                            imposter_broker_stats[seller] = {"count": 0, "total_value": 0, "total_lot": 0, "buy_count": 0, "sell_count": 0, "strong": 0, "possible": 0}
                        imposter_broker_stats[seller]["count"] += 1
                        imposter_broker_stats[seller]["sell_count"] += 1
                        imposter_broker_stats[seller]["total_value"] += value
                        imposter_broker_stats[seller]["total_lot"] += qty
                        imposter_broker_stats[seller][level.lower()] += 1
                
                all_trades.append(trade_info)
            
            # Format broker stats
            by_broker = [
                {
                    "broker": code,
                    "name": broker_info.get(code, {}).get('name', code),
                    "count": stats["count"],
                    "buy_count": stats["buy_count"],
                    "sell_count": stats["sell_count"],
                    "total_value": stats["total_value"],
                    "total_lot": stats["total_lot"],
                    "strong_count": stats["strong"],
                    "possible_count": stats["possible"]
                }
                for code, stats in sorted(imposter_broker_stats.items(), key=lambda x: x[1]['total_value'], reverse=True)
            ]
            
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "total_transactions": len(all_trades),
                "imposter_count": len(imposter_trades),
                "thresholds": {
                    "p95": int(p95_threshold),
                    "p99": int(p99_threshold),
                    "median": int(median_lot),
                    "mean": int(mean_lot)
                },
                "all_trades": all_trades[:500],  # Limit for performance
                "imposter_trades": imposter_trades,
                "by_broker": by_broker,
                "summary": {
                    "total_value": total_value,
                    "total_lot": total_lot,
                    "imposter_value": imposter_value,
                    "imposter_lot": imposter_lot,
                    "imposter_percentage": (imposter_value / total_value * 100) if total_value > 0 else 0,
                    "strong_count": strong_count,
                    "possible_count": possible_count
                }
            }
        except Exception as e:
            print(f"[!] Error detecting imposter trades: {e}")
            import traceback
            traceback.print_exc()
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "total_transactions": 0,
                "imposter_count": 0,
                "thresholds": {"p95": 0, "p99": 0, "median": 0, "mean": 0},
                "all_trades": [],
                "imposter_trades": [],
                "by_broker": [],
                "summary": {
                    "total_value": 0,
                    "total_lot": 0,
                    "imposter_value": 0,
                    "imposter_lot": 0,
                    "imposter_percentage": 0,
                    "strong_count": 0,
                    "possible_count": 0
                },
                "error": str(e)
            }
        finally:
            conn.close()



    def analyze_speed(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """
        Analyze trading speed - trades per second/minute and burst patterns.
        
        Speed Analysis = Measuring how fast brokers execute trades,
        identifying high-frequency traders and burst patterns.
        
        Args:
            ticker: Stock symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            Dict with speed analysis results
        """
        import json
        import os
        import config
        from collections import defaultdict
        
        conn = self._get_conn()
        try:
            # Load broker classification
            broker_file = os.path.join(config.DATA_DIR, "brokers_idx.json")
            with open(broker_file, 'r', encoding='utf-8') as f:
                broker_data = json.load(f)
            
            broker_info = {b.get('code', ''): b.get('name', '') for b in broker_data.get('brokers', [])}
            
            # Get all transactions
            query = """
            SELECT trade_date, trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date, trade_time
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date))
            
            if df.empty:
                return {
                    "ticker": ticker.upper(),
                    "date_range": {"start": start_date, "end": end_date},
                    "speed_by_broker": [],
                    "burst_events": [],
                    "timeline": [],
                    "summary": {
                        "total_trades": 0,
                        "unique_seconds": 0,
                        "avg_trades_per_second": 0,
                        "max_trades_per_second": 0,
                        "peak_time": None
                    }
                }
            
            # Analyze trades per second
            trades_per_second = defaultdict(int)
            broker_speed = defaultdict(lambda: {"trades": 0, "buy": 0, "sell": 0, "value": 0, "seconds_active": set()})
            
            for _, row in df.iterrows():
                trade_time = row['trade_time']
                buyer = row['buyer_code']
                seller = row['seller_code']
                qty = int(row['qty'])
                price = float(row['price'])
                value = qty * price * 100
                
                # Count trades per second
                trades_per_second[trade_time] += 1
                
                # Track broker speed
                broker_speed[buyer]["trades"] += 1
                broker_speed[buyer]["buy"] += 1
                broker_speed[buyer]["value"] += value
                broker_speed[buyer]["seconds_active"].add(trade_time)
                
                broker_speed[seller]["trades"] += 1
                broker_speed[seller]["sell"] += 1
                broker_speed[seller]["value"] += value
                broker_speed[seller]["seconds_active"].add(trade_time)
            
            # Find burst events (>= 10 trades in 1 second)
            burst_events = []
            for time_key, count in sorted(trades_per_second.items(), key=lambda x: x[1], reverse=True):
                if count >= 10:
                    burst_events.append({
                        "trade_time": time_key,
                        "trade_count": count
                    })
            
            # Format broker speed stats
            speed_by_broker = []
            for code, stats in broker_speed.items():
                seconds_active = len(stats["seconds_active"])
                trades_per_sec = stats["trades"] / seconds_active if seconds_active > 0 else 0
                
                speed_by_broker.append({
                    "broker": code,
                    "name": broker_info.get(code, code),
                    "total_trades": stats["trades"],
                    "buy_trades": stats["buy"],
                    "sell_trades": stats["sell"],
                    "total_value": stats["value"],
                    "seconds_active": seconds_active,
                    "trades_per_second": round(trades_per_sec, 2)
                })
            
            # Sort by total trades descending
            speed_by_broker.sort(key=lambda x: x["total_trades"], reverse=True)
            
            # Create timeline (trades per minute)
            trades_per_minute = defaultdict(int)
            for time_key, count in trades_per_second.items():
                minute_key = time_key[:5] if len(time_key) >= 5 else time_key  # HH:MM
                trades_per_minute[minute_key] += count
            
            timeline = [
                {"time": t, "trades": c}
                for t, c in sorted(trades_per_minute.items())
            ]
            
            # Summary stats
            total_trades = len(df)
            unique_seconds = len(trades_per_second)
            avg_per_sec = total_trades / unique_seconds if unique_seconds > 0 else 0
            max_per_sec = max(trades_per_second.values()) if trades_per_second else 0
            peak_time = max(trades_per_second, key=trades_per_second.get) if trades_per_second else None
            
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "speed_by_broker": speed_by_broker[:50],  # Top 50
                "burst_events": burst_events[:50],  # Top 50 bursts
                "timeline": timeline,
                "summary": {
                    "total_trades": total_trades,
                    "unique_seconds": unique_seconds,
                    "avg_trades_per_second": round(avg_per_sec, 2),
                    "max_trades_per_second": max_per_sec,
                    "peak_time": peak_time
                }
            }
        except Exception as e:
            print(f"[!] Error analyzing speed: {e}")
            import traceback
            traceback.print_exc()
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "speed_by_broker": [],
                "burst_events": [],
                "timeline": [],
                "summary": {
                    "total_trades": 0,
                    "unique_seconds": 0,
                    "avg_trades_per_second": 0,
                    "max_trades_per_second": 0,
                    "peak_time": None
                },
                "error": str(e)
            }
        finally:
            conn.close()

    def get_combined_analysis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """
        Combined analysis merging Impostor and Speed data for trading signals.
        
        Calculates:
        - Overall signal strength (bullish/bearish based on impostor flow + speed)
        - Power brokers (appearing in both top impostor and top speed lists)
        - Net direction from impostor trades
        - Activity timeline with burst markers
        """
        try:
            # Get impostor and speed analysis
            impostor_data = self.detect_imposter_trades(ticker, start_date, end_date)
            speed_data = self.analyze_speed(ticker, start_date, end_date)
            
            # Extract impostor trades and stats
            impostor_trades = impostor_data.get("trades", [])
            impostor_broker_stats = impostor_data.get("broker_stats", [])
            impostor_summary = impostor_data.get("summary", {})
            
            # Extract speed stats
            speed_by_broker = speed_data.get("speed_by_broker", [])
            burst_events = speed_data.get("burst_events", [])
            speed_summary = speed_data.get("summary", {})
            timeline = speed_data.get("timeline", [])
            
            # Calculate impostor flow (net buy vs sell)
            impostor_buy_value = 0
            impostor_sell_value = 0
            impostor_buy_count = 0
            impostor_sell_count = 0
            
            for trade in impostor_trades:
                value = trade.get("value", 0)
                if trade.get("side") == "B":
                    impostor_buy_value += value
                    impostor_buy_count += 1
                else:
                    impostor_sell_value += value
                    impostor_sell_count += 1
            
            impostor_net_value = impostor_buy_value - impostor_sell_value
            total_impostor_value = impostor_buy_value + impostor_sell_value
            
            # Calculate impostor flow percentage
            if total_impostor_value > 0:
                impostor_buy_pct = (impostor_buy_value / total_impostor_value) * 100
                impostor_sell_pct = (impostor_sell_value / total_impostor_value) * 100
            else:
                impostor_buy_pct = 0
                impostor_sell_pct = 0
            
            # Find power brokers (appear in both impostor and speed top lists)
            # Top 10 impostor brokers by value
            impostor_broker_codes = set()
            impostor_broker_data = {}
            for broker in impostor_broker_stats[:10]:
                code = broker.get("broker_code", "")
                impostor_broker_codes.add(code)
                impostor_broker_data[code] = broker
            
            # Top 10 speed brokers by trade count
            speed_broker_codes = set()
            speed_broker_data = {}
            for broker in speed_by_broker[:10]:
                code = broker.get("broker_code", "")
                speed_broker_codes.add(code)
                speed_broker_data[code] = broker
            
            # Power brokers = intersection
            power_broker_codes = impostor_broker_codes & speed_broker_codes
            power_brokers = []
            
            for code in power_broker_codes:
                imp_data = impostor_broker_data.get(code, {})
                spd_data = speed_broker_data.get(code, {})
                
                # Calculate combined score (normalized impostor value + speed rank)
                imp_total_value = imp_data.get("total_value", 0)
                spd_total_trades = spd_data.get("total_trades", 0)
                
                # Net direction from impostor data
                imp_buy_value = imp_data.get("buy_value", 0)
                imp_sell_value = imp_data.get("sell_value", 0)
                net_direction = "BUY" if imp_buy_value > imp_sell_value else "SELL"
                net_value = abs(imp_buy_value - imp_sell_value)
                
                power_brokers.append({
                    "broker_code": code,
                    "broker_name": imp_data.get("broker_name", ""),
                    "broker_type": imp_data.get("broker_type", ""),
                    "impostor_value": imp_total_value,
                    "impostor_count": imp_data.get("trade_count", 0),
                    "strong_count": imp_data.get("strong_count", 0),
                    "possible_count": imp_data.get("possible_count", 0),
                    "speed_trades": spd_total_trades,
                    "speed_tps": spd_data.get("trades_per_second", 0),
                    "net_direction": net_direction,
                    "net_value": net_value,
                    "buy_value": imp_buy_value,
                    "sell_value": imp_sell_value
                })
            
            # Sort power brokers by impostor value
            power_brokers.sort(key=lambda x: x["impostor_value"], reverse=True)
            
            # Calculate signal strength
            # Factors:
            # 1. Impostor flow direction (buy vs sell)
            # 2. Strong impostor count
            # 3. Speed/activity level
            # 4. Power broker consensus
            
            signal_points = 0
            max_points = 100
            
            # Factor 1: Impostor flow (max 40 points)
            if total_impostor_value > 0:
                flow_ratio = abs(impostor_buy_value - impostor_sell_value) / total_impostor_value
                signal_points += flow_ratio * 40
            
            # Factor 2: Strong impostor count (max 25 points)
            strong_count = impostor_summary.get("strong_count", 0)
            if strong_count >= 10:
                signal_points += 25
            elif strong_count >= 5:
                signal_points += 20
            elif strong_count >= 3:
                signal_points += 15
            elif strong_count >= 1:
                signal_points += 10
            
            # Factor 3: Activity level / burst events (max 20 points)
            burst_count = len(burst_events)
            if burst_count >= 10:
                signal_points += 20
            elif burst_count >= 5:
                signal_points += 15
            elif burst_count >= 3:
                signal_points += 10
            elif burst_count >= 1:
                signal_points += 5
            
            # Factor 4: Power broker count (max 15 points)
            power_count = len(power_brokers)
            if power_count >= 5:
                signal_points += 15
            elif power_count >= 3:
                signal_points += 10
            elif power_count >= 1:
                signal_points += 5
            
            # Determine signal direction
            if impostor_net_value > 0:
                signal_direction = "BULLISH"
            elif impostor_net_value < 0:
                signal_direction = "BEARISH"
            else:
                signal_direction = "NEUTRAL"
            
            # Calculate confidence percentage
            confidence = min(signal_points, max_points)
            
            # Determine signal level
            if confidence >= 70:
                signal_level = "STRONG"
            elif confidence >= 50:
                signal_level = "MODERATE"
            elif confidence >= 30:
                signal_level = "WEAK"
            else:
                signal_level = "NEUTRAL"
            
            # Add burst markers to timeline
            burst_times = set()
            for burst in burst_events:
                burst_times.add(burst.get("second", ""))
            
            for item in timeline:
                item["has_burst"] = item.get("time", "") in burst_times
            
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "signal": {
                    "direction": signal_direction,
                    "level": signal_level,
                    "confidence": round(confidence, 1),
                    "description": f"{signal_level} {signal_direction}" if signal_direction != "NEUTRAL" else "NO CLEAR SIGNAL"
                },
                "impostor_flow": {
                    "buy_value": impostor_buy_value,
                    "sell_value": impostor_sell_value,
                    "net_value": impostor_net_value,
                    "buy_count": impostor_buy_count,
                    "sell_count": impostor_sell_count,
                    "buy_pct": round(impostor_buy_pct, 1),
                    "sell_pct": round(impostor_sell_pct, 1)
                },
                "power_brokers": power_brokers,
                "key_metrics": {
                    "strong_impostor_count": impostor_summary.get("strong_count", 0),
                    "possible_impostor_count": impostor_summary.get("possible_count", 0),
                    "total_impostor_value": total_impostor_value,
                    "avg_tps": speed_summary.get("avg_trades_per_second", 0),
                    "max_tps": speed_summary.get("max_trades_per_second", 0),
                    "peak_time": speed_summary.get("peak_time", None),
                    "burst_count": burst_count,
                    "total_trades": speed_summary.get("total_trades", 0)
                },
                "timeline": timeline,
                "burst_events": burst_events,
                "thresholds": impostor_data.get("thresholds", {}),
                "imposter_analysis": impostor_data,
                "speed_analysis": speed_data
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "signal": {
                    "direction": "NEUTRAL",
                    "level": "NEUTRAL",
                    "confidence": 0,
                    "description": "ERROR"
                },
                "impostor_flow": {
                    "buy_value": 0,
                    "sell_value": 0,
                    "net_value": 0,
                    "buy_count": 0,
                    "sell_count": 0,
                    "buy_pct": 0,
                    "sell_pct": 0
                },
                "power_brokers": [],
                "key_metrics": {},
                "timeline": [],
                "burst_events": [],
                "thresholds": {},
                "error": str(e)
            }

    def get_broker_profile(self, ticker: str, broker_code: str, start_date: str, end_date: str) -> Dict:
        """
        Get detailed profile for a specific broker (Phase 4).
        """
        import json
        import os
        import config
        import numpy as np
        
        conn = self._get_conn()
        try:
            # 1. Get broker name
            broker_name = broker_code
            try:
                broker_file = os.path.join(config.DATA_DIR, "brokers_idx.json")
                if os.path.exists(broker_file):
                    with open(broker_file, 'r', encoding='utf-8') as f:
                        broker_data = json.load(f)
                        for b in broker_data.get('brokers', []):
                            if b.get('code') == broker_code:
                                broker_name = b.get('name')
                                break
            except Exception as e:
                print(f"Error loading broker name: {e}")

            # 2. Get all trades involving this broker
            # Note: value = price * qty * 100 (Indonesian stocks)
            query = """
            SELECT trade_date, trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ? 
            AND (buyer_code = ? OR seller_code = ?)
            ORDER BY trade_date DESC, trade_time DESC
            """
            
            df = pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date, broker_code, broker_code))
            
            if df.empty:
                return {
                    "broker": broker_code,
                    "name": broker_name,
                    "found": False,
                    "summary": {},
                    "hourly_stats": [],
                    "counterparties": {"top_sellers": [], "top_buyers": []},
                    "recent_trades": []
                }
                
            # Calculate Value
            df['value'] = df['price'] * df['qty'] * 100
            
            # 3. Analyze Trades
            buy_trades = df[df['buyer_code'] == broker_code].copy()
            sell_trades = df[df['seller_code'] == broker_code].copy()
            
            # Summary Stats
            buy_vol = int(buy_trades['qty'].sum())
            buy_val = int(buy_trades['value'].sum())
            buy_freq = len(buy_trades)
            avg_buy_price = int(buy_val / (buy_vol * 100)) if buy_vol > 0 else 0
            
            sell_vol = int(sell_trades['qty'].sum())
            sell_val = int(sell_trades['value'].sum())
            sell_freq = len(sell_trades)
            avg_sell_price = int(sell_val / (sell_vol * 100)) if sell_vol > 0 else 0
            
            net_val = buy_val - sell_val
            
            # 4. Hourly Stats
            # Extract hour from trade_time (HH:MM:SS)
            df['hour'] = df['trade_time'].apply(lambda x: str(x).split(':')[0] if ':' in str(x) else '00')
            
            hourly_stats = []
            for hour, group in df.groupby('hour'):
                h_buy = group[group['buyer_code'] == broker_code]
                h_sell = group[group['seller_code'] == broker_code]
                
                hourly_stats.append({
                    "hour": hour,
                    "buy_val": int(h_buy['value'].sum()),
                    "sell_val": int(h_sell['value'].sum()),
                    "freq": len(group)
                })
            
            hourly_stats.sort(key=lambda x: x['hour'])
            
            # 5. Top Counterparties
            # Who did they buy FROM? (Sellers)
            top_sellers = []
            if not buy_trades.empty:
                sellers = buy_trades.groupby('seller_code')['value'].sum().reset_index()
                sellers = sellers.sort_values('value', ascending=False).head(5)
                for _, row in sellers.iterrows():
                    top_sellers.append({
                        "broker": row['seller_code'],
                        "type": "SELLER", 
                        "value": int(row['value'])
                    })
                    
            # Who did they sell TO? (Buyers)
            top_buyers = []
            if not sell_trades.empty:
                buyers = sell_trades.groupby('buyer_code')['value'].sum().reset_index()
                buyers = buyers.sort_values('value', ascending=False).head(5)
                for _, row in buyers.iterrows():
                    top_buyers.append({
                        "broker": row['buyer_code'],
                        "type": "BUYER", 
                        "value": int(row['value'])
                    })

            # 6. Recent Top Trades (Large value)
            top_trades_df = df.nlargest(50, 'value')
            top_trades = []
            for _, row in top_trades_df.iterrows():
                top_trades.append({
                    "time": row['trade_time'],
                    "price": int(row['price']),
                    "qty": int(row['qty']),
                    "value": int(row['value']),
                    "action": "BUY" if row['buyer_code'] == broker_code else "SELL",
                    "counterparty": row['seller_code'] if row['buyer_code'] == broker_code else row['buyer_code']
                })
                
            return {
                "broker": broker_code,
                "name": broker_name,
                "found": True,
                "summary": {
                    "buy_value": buy_val,
                    "sell_value": sell_val,
                    "net_value": net_val,
                    "buy_freq": buy_freq,
                    "sell_freq": sell_freq,
                    "avg_buy_price": avg_buy_price,
                    "avg_sell_price": avg_sell_price
                },
                "hourly_stats": hourly_stats,
                "counterparties": {
                    "top_sellers": top_sellers, 
                    "top_buyers": top_buyers
                },
                "recent_trades": top_trades
            }
        except Exception as e:
            print(f"[!] Error getting broker profile: {e}")
            return {"error": str(e)}
        finally:
            conn.close()
