"""
Moving Average Calculator for Price Volume.

Extracted from routes/price_volume.py for reusability.
"""
from typing import List, Dict


def calculate_moving_averages(data: List[Dict], periods: List[int] = [5, 10, 20]) -> Dict:
    """
    Calculate moving averages for price and volume data.
    
    Args:
        data: List of OHLCV records with 'close', 'volume', 'time' keys
        periods: List of MA periods to calculate
        
    Returns:
        Dictionary with MA data for each period
    """
    if not data or len(data) < max(periods):
        return {f"ma{p}": [] for p in periods}
    
    closes = [d['close'] for d in data]
    volumes = [d['volume'] for d in data]
    times = [d['time'] for d in data]
    
    result = {}
    
    # Calculate price MAs
    for period in periods:
        ma_values = []
        for i in range(len(closes)):
            if i < period - 1:
                ma_values.append(None)
            else:
                window = closes[i - period + 1:i + 1]
                ma_values.append(sum(window) / period)
        
        result[f"ma{period}"] = [
            {"time": times[i], "value": ma_values[i]}
            for i in range(len(times))
            if ma_values[i] is not None
        ]
    
    # Calculate volume MA20
    volume_ma = []
    for i in range(len(volumes)):
        if i < 19:
            volume_ma.append(None)
        else:
            window = volumes[i - 19:i + 1]
            volume_ma.append(sum(window) / 20)
    
    result["volumeMa20"] = [
        {"time": times[i], "value": volume_ma[i]}
        for i in range(len(times))
        if volume_ma[i] is not None
    ]
    
    return result
