from accum_dist import TradeAnalyzer
import time

def test_interval():
    ta = TradeAnalyzer()
    ticker = "BBCA"
    
    trades = [
        {"trade_number": "1", "action": "buy", "price": "8000", "lot": "600"}, # Big order
        {"trade_number": "2", "action": "buy", "price": "8010", "lot": "100"},
        {"trade_number": "3", "action": "sell", "price": "8020", "lot": "50"},
    ]
    
    print("Processing trades...")
    ta.process_trades(ticker, trades)
    
    print("Generating snapshot...")
    snap = ta.get_interval_snapshot(ticker)
    print(f"Snapshot: {snap}")
    
    assert snap["big_order_count"] == 1
    assert snap["status"] == "Bullish"
    assert snap["buy_vol"] == 700
    assert snap["sell_vol"] == 50
    
    print("Resetting interval...")
    ta.reset_interval(ticker)
    
    snap2 = ta.get_interval_snapshot(ticker)
    print(f"Snapshot after reset: {snap2}")
    assert snap2["buy_vol"] == 0
    assert snap2["big_order_count"] == 0

if __name__ == "__main__":
    test_interval()
    print("Test passed!")
