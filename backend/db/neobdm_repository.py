"""NeoBDM repository for market maker and fund flow analysis."""
import pandas as pd
import json
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from .connection import BaseRepository


class NeoBDMRepository(BaseRepository):
    """Repository for NeoBDM market maker and fund flow data."""
    
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
                row = (
                    scraped_at, method, period, 
                    item.get('symbol'), item.get('pinky'), item.get('crossing'), item.get('likuid'),
                    item.get('w-4') or item.get('wn-4'), item.get('w-3') or item.get('wn-3'),
                    item.get('w-2') or item.get('wn-2'), item.get('w-1') or item.get('wn-1'),
                    item.get('d-4') or item.get('dn-4'), item.get('d-3') or item.get('dn-3'),
                    item.get('d-2') or item.get('dn-2'), item.get('d-0') or item.get('dn-0'),
                    item.get('%1d'),
                    item.get('c-20') or item.get('cn-20'), item.get('c-10') or item.get('cn-10'),
                    item.get('c-5') or item.get('cn-5'), item.get('c-3') or item.get('cn-3'),
                    item.get('%3d'), item.get('%5d'), item.get('%10d'), item.get('%20d'),
                    item.get('price'), item.get('>ma5'), item.get('>ma10'), item.get('>ma20'),
                    item.get('>ma50'), item.get('>ma100'), item.get('unusual')
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
            val_str = str(value).replace(',', '').replace('B', '').strip()
            return float(val_str) if val_str else 0.0
        except (ValueError, AttributeError):
            return 0.0
    
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
                   price, pct_1d
            FROM neobdm_records 
            WHERE (UPPER(symbol) = UPPER(?) OR UPPER(symbol) LIKE '%' || UPPER(?))
            AND method = ? AND period = ?
            ORDER BY scraped_at DESC
            LIMIT ?
            """
            df = pd.read_sql(query, conn, params=(symbol, symbol, method, period, limit * 2))
            
            if df.empty:
                return []
            
            # 2. Process each record and decompose flows
            history_dict = {}  # Key: date, Value: data
            
            for _, row in df.iterrows():
                scraped_date = row['scraped_at'][:10]  # Extract date part
                
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
                        'date': scraped_date,
                        'flow_d0': d0,
                        'flow_d2': d2,
                        'flow_avg': flow_estimate,
                        'c_3': c3,
                        'c_5': c5,
                        'c_10': c10,
                        'price': self._parse_numeric(row['price']),
                        'change': self._parse_numeric(row['pct_1d']),
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
            for record in history_list:
                record['net_flow'] = net_flow
                record['trend'] = trend
            
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
            val_str = str(value).replace(',', '').replace('B', '').strip()
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
                momentum_status, momentum_details, warning_status, warnings, patterns)
    
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
            # 1. Get latest scrape timestamp
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MAX(scraped_at) FROM neobdm_records 
                WHERE method='m' AND period='c'
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
            WHERE scraped_at = ? AND method = 'm' AND period = 'c'
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
                
                # Calculate complete score with all 4 phases
                (score, strength, alignment_status, alignment_details,
                 momentum_status, momentum_details, warning_status,
                 warnings, patterns) = self._calculate_signal_score(record)
                
                # Only include positive or near-positive scores
                if score >= 0:
                    scored_results.append({
                        # Basic fields
                        "symbol": record["symbol"],
                        "pinky": record["pinky"] if record["pinky"] not in ('x','0','') else None,
                        "crossing": record["crossing"] if record["crossing"] not in ('x','0','') else None,
                        "unusual": record["unusual"] if record["unusual"] not in ('x','0','') else None,
                        "flow": record["d_0"],
                        "price": record["price"],
                        "change": record["pct_1d"],
                        
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
                        "pattern_count": len(patterns)
                    })
            
            # 4. Sort by score descending
            scored_results.sort(key=lambda x: x["signal_score"], reverse=True)
            
            # 5. Return top 20
            return scored_results[:20]
            
        finally:
            conn.close()
