"""
Imposter Trade Analyzer for Done Detail.

Detects smart money using retail broker accounts with abnormally large lot sizes.

Method: Percentile-based detection
- STRONG IMPOSTER: Lot >= P99 (Top 1%) from retail/mixed broker
- POSSIBLE IMPOSTER: Lot >= P95 (Top 5%) from retail/mixed broker
"""
import pandas as pd
import numpy as np
from typing import Dict, Set
from shared.utils.broker_utils import get_retail_brokers, get_mixed_brokers, get_broker_name


class ImposterAnalyzer:
    """Detects imposter trades using statistical outlier detection."""
    
    def __init__(self):
        self._retail_codes: Set[str] = None
        self._mixed_codes: Set[str] = None
    
    def _load_broker_codes(self):
        """Lazy load broker classification."""
        if self._retail_codes is None:
            self._retail_codes = get_retail_brokers()
            self._mixed_codes = get_mixed_brokers()
    
    def detect_imposter_trades(
        self, 
        df: pd.DataFrame, 
        ticker: str,
        start_date: str, 
        end_date: str
    ) -> Dict:
        """
        Detect imposter trades from trade data.
        
        Args:
            df: DataFrame with trade_date, trade_time, price, qty, buyer_code, seller_code
            ticker: Stock ticker symbol
            start_date: Start date string
            end_date: End date string
            
        Returns:
            Dict with imposter analysis results
        """
        self._load_broker_codes()
        
        if df.empty:
            return self._empty_result(ticker, start_date, end_date)
        
        # Calculate percentile thresholds
        all_qty = df['qty'].values
        p95_threshold = float(np.percentile(all_qty, 95))
        p99_threshold = float(np.percentile(all_qty, 99))
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
        
        total_records = len(df)
        
        for idx, (_, row) in enumerate(df.iterrows()):
            if (idx + 1) % 10000 == 0:
                print(f"\r      📍 Scanning: {idx + 1:,}/{total_records:,} | Imposters: {len(imposter_trades):,}", end="", flush=True)
            
            buyer = row['buyer_code']
            seller = row['seller_code']
            qty = int(row['qty'])
            price = float(row['price'])
            value = qty * price * 100
            trade_date = row['trade_date']
            trade_time = row['trade_time']
            
            total_value += value
            total_lot += qty
            
            buyer_is_retail_like = buyer in self._retail_codes or buyer in self._mixed_codes
            seller_is_retail_like = seller in self._retail_codes or seller in self._mixed_codes
            
            # Get imposter level
            level = self._get_imposter_level(qty, p95_threshold, p99_threshold)
            percentile = round((np.searchsorted(np.sort(all_qty), qty) / len(all_qty)) * 100, 1)
            
            trade_info = {
                "trade_date": trade_date,
                "trade_time": trade_time,
                "buyer_code": buyer,
                "buyer_name": get_broker_name(buyer),
                "seller_code": seller,
                "seller_name": get_broker_name(seller),
                "qty": qty,
                "price": price,
                "value": value,
                "is_imposter": False,
                "imposter_side": None,
                "imposter_broker": None,
                "imposter_level": None,
                "percentile": percentile
            }
            
            # Check buyer side
            if buyer_is_retail_like and level:
                trade_info["is_imposter"] = True
                trade_info["imposter_side"] = "BUY"
                trade_info["imposter_broker"] = buyer
                trade_info["imposter_level"] = level
                
                self._record_imposter(
                    imposter_trades, imposter_broker_stats,
                    trade_date, trade_time, buyer, "BUY", qty, price, value, seller, level, percentile
                )
                
                imposter_value += value
                imposter_lot += qty
                if level == "STRONG":
                    strong_count += 1
                else:
                    possible_count += 1
            
            # Check seller side
            if seller_is_retail_like and level:
                if trade_info["is_imposter"]:
                    trade_info["imposter_side"] = "BOTH"
                    trade_info["imposter_broker"] = f"{trade_info['imposter_broker']}/{seller}"
                else:
                    trade_info["is_imposter"] = True
                    trade_info["imposter_side"] = "SELL"
                    trade_info["imposter_broker"] = seller
                    trade_info["imposter_level"] = level
                
                self._record_imposter(
                    imposter_trades, imposter_broker_stats,
                    trade_date, trade_time, seller, "SELL", qty, price, value, buyer, level, percentile
                )
                
                if not buyer_is_retail_like or not level:
                    imposter_value += value
                    imposter_lot += qty
                    if level == "STRONG":
                        strong_count += 1
                    else:
                        possible_count += 1
            
            all_trades.append(trade_info)
        
        print()  # Newline after progress
        
        # Format broker stats
        by_broker = self._format_broker_stats(imposter_broker_stats)
        
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
            "all_trades": all_trades[:2000],
            "imposter_trades": imposter_trades[:5000],
            "by_broker": by_broker[:30],
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
    
    def _get_imposter_level(self, lot: int, p95: float, p99: float) -> str:
        """Determine imposter level based on lot size."""
        if lot >= p99:
            return "STRONG"
        elif lot >= p95:
            return "POSSIBLE"
        return None
    
    def _record_imposter(
        self, 
        imposter_trades: list,
        broker_stats: dict,
        trade_date: str,
        trade_time: str,
        broker: str,
        direction: str,
        qty: int,
        price: float,
        value: float,
        counterparty: str,
        level: str,
        percentile: float
    ):
        """Record an imposter trade."""
        imposter_trades.append({
            "trade_date": trade_date,
            "trade_time": trade_time,
            "broker_code": broker,
            "broker_name": get_broker_name(broker),
            "broker_type": "retail" if broker in self._retail_codes else "mixed",
            "direction": direction,
            "qty": qty,
            "price": price,
            "value": value,
            "counterparty": counterparty,
            "level": level,
            "percentile": percentile
        })
        
        if broker not in broker_stats:
            broker_stats[broker] = {
                "count": 0, "total_value": 0, "total_lot": 0,
                "buy_count": 0, "sell_count": 0,
                "strong": 0, "possible": 0,
                "buy_value": 0, "sell_value": 0
            }
        
        stats = broker_stats[broker]
        stats["count"] += 1
        stats["total_value"] += value
        stats["total_lot"] += qty
        stats[level.lower()] += 1
        
        if direction == "BUY":
            stats["buy_count"] += 1
            stats["buy_value"] += value
        else:
            stats["sell_count"] += 1
            stats["sell_value"] += value
    
    def _format_broker_stats(self, broker_stats: dict) -> list:
        """Format broker stats for output."""
        result = []
        for code, stats in sorted(broker_stats.items(), key=lambda x: x[1]['total_value'], reverse=True):
            result.append({
                "broker": code,
                "name": get_broker_name(code),
                "broker_type": "retail" if code in self._retail_codes else "mixed",
                "count": stats["count"],
                "buy_count": stats["buy_count"],
                "sell_count": stats["sell_count"],
                "buy_value": stats["buy_value"],
                "sell_value": stats["sell_value"],
                "total_value": stats["total_value"],
                "total_lot": stats["total_lot"],
                "strong_count": stats["strong"],
                "possible_count": stats["possible"]
            })
        return result
    
    def _empty_result(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Return empty result structure."""
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
