"""
Speed Analyzer for Done Detail.

Analyzes trading speed - trades per second/minute and burst patterns.
Identifies high-frequency traders and burst patterns.
"""
import pandas as pd
from typing import Dict
from collections import defaultdict
from shared.utils.broker_utils import get_broker_name


class SpeedAnalyzer:
    """Analyzes trading speed and burst patterns."""
    
    def analyze_speed(
        self, 
        df: pd.DataFrame, 
        ticker: str,
        start_date: str, 
        end_date: str
    ) -> Dict:
        """
        Analyze trading speed from trade data.
        
        Args:
            df: DataFrame with trade_date, trade_time, price, qty, buyer_code, seller_code
            ticker: Stock ticker symbol
            start_date: Start date string
            end_date: End date string
            
        Returns:
            Dict with speed analysis results
        """
        if df.empty:
            return self._empty_result(ticker, start_date, end_date)
        
        # Track trades per second and broker activity
        trades_per_second = defaultdict(int)
        broker_second_counts = defaultdict(lambda: defaultdict(int))
        
        broker_speed = defaultdict(lambda: {
            "trades": 0, "buy": 0, "sell": 0,
            "value": 0, "seconds_active": set()
        })
        
        total_records = len(df)
        
        for idx, (_, row) in enumerate(df.iterrows()):
            if (idx + 1) % 10000 == 0:
                print(f"\r      📍 Speed: {idx + 1:,}/{total_records:,} | Time slots: {len(trades_per_second):,}", end="", flush=True)
            
            trade_time = row['trade_time']
            buyer = row['buyer_code']
            seller = row['seller_code']
            qty = int(row['qty'])
            price = float(row['price'])
            value = qty * price * 100
            
            # Track global speed
            trades_per_second[trade_time] += 1
            
            # Track per-broker speed
            broker_second_counts[buyer][trade_time] += 1
            broker_second_counts[seller][trade_time] += 1
            
            # Track broker speed stats
            broker_speed[buyer]["trades"] += 1
            broker_speed[buyer]["buy"] += 1
            broker_speed[buyer]["value"] += value
            broker_speed[buyer]["seconds_active"].add(trade_time)
            
            broker_speed[seller]["trades"] += 1
            broker_speed[seller]["sell"] += 1
            broker_speed[seller]["value"] += value
            broker_speed[seller]["seconds_active"].add(trade_time)
        
        print()  # Newline after progress
        
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
                "name": get_broker_name(code),
                "total_trades": stats["trades"],
                "buy_trades": stats["buy"],
                "sell_trades": stats["sell"],
                "total_value": stats["value"],
                "seconds_active": seconds_active,
                "trades_per_second": round(trades_per_sec, 2)
            })
        
        speed_by_broker.sort(key=lambda x: x["total_trades"], reverse=True)
        
        # Generate timelines for top 10 speed brokers
        broker_timelines = {}
        top_speed_brokers = [b["broker"] for b in speed_by_broker[:10]]
        
        for broker in top_speed_brokers:
            b_timeline = []
            if broker in broker_second_counts:
                sorted_points = sorted(broker_second_counts[broker].items())
                for t, c in sorted_points[:100]:
                    b_timeline.append({"time": t, "trades": c})
            broker_timelines[broker] = b_timeline
        
        # Create timeline (trades per minute)
        trades_per_minute = defaultdict(int)
        for time_key, count in trades_per_second.items():
            minute_key = time_key[:5] if len(time_key) >= 5 else time_key
            trades_per_minute[minute_key] += count
        
        timeline = [
            {"minute": m, "trades": c}
            for m, c in sorted(trades_per_minute.items())
        ]
        
        # Calculate summary
        unique_seconds = len(trades_per_second)
        total_trades = sum(trades_per_second.values())
        max_trades = max(trades_per_second.values()) if trades_per_second else 0
        peak_time = max(trades_per_second, key=trades_per_second.get) if trades_per_second else None
        
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "speed_by_broker": speed_by_broker[:30],
            "burst_events": burst_events[:50],
            "timeline": timeline,
            "broker_timelines": broker_timelines,
            "summary": {
                "total_trades": total_trades,
                "unique_seconds": unique_seconds,
                "avg_trades_per_second": round(total_trades / unique_seconds, 2) if unique_seconds > 0 else 0,
                "max_trades_per_second": max_trades,
                "peak_time": peak_time,
                "burst_count": len(burst_events)
            }
        }
    
    def _empty_result(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Return empty result structure."""
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "speed_by_broker": [],
            "burst_events": [],
            "timeline": [],
            "broker_timelines": {},
            "summary": {
                "total_trades": 0,
                "unique_seconds": 0,
                "avg_trades_per_second": 0,
                "max_trades_per_second": 0,
                "peak_time": None,
                "burst_count": 0
            }
        }
