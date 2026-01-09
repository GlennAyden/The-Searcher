import sys
import os

# Add backend to sys path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.modules.market_forecaster import MarketForecaster

def test():
    print("Testing Market Forecaster...")
    try:
        forecaster = MarketForecaster()
        
        # Test with a liquid ticker
        ticker = "BBCA"
        print(f"Fetching forecast for {ticker}...")
        
        result = forecaster.get_forecast(ticker)
        
        if "error" in result:
            print(f"Error: {result['error']}")
        else:
            print("Success!")
            print(f"Current Price: {result['current_price']}")
            print(f"Trade Plan Action: {result['trade_plan']['action']}")
            print(f"Targets: {result['trade_plan']['targets']}")
            print(f"Support Levels: {result['technical_analysis']['supports'][:3]}")
            print(f"Chart Data Points: {len(result['chart_data'])}")
            
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
