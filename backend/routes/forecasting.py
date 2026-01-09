from fastapi import APIRouter, HTTPException
from modules.market_forecaster import MarketForecaster
import urllib.parse

router = APIRouter()
forecaster = MarketForecaster() # Initialize once

@router.get("/forecast/{symbol}")
async def get_forecast(symbol: str):
    """
    Get detailed forecast and trade plan for a symbol.
    Triggers on-demand OHLCV fetch and analysis.
    """
    try:
        # Decode symbol just in case
        decoded_symbol = urllib.parse.unquote(symbol).upper()
        
        result = forecaster.get_forecast(decoded_symbol)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
            
        return result
    except Exception as e:
        print(f"Error generating forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/forecast/{symbol}/backtest")
async def get_backtest_results(symbol: str, days: int = 180):
    """
    Run historical backtest for the given symbol.
    
    Args:
        symbol: Stock ticker (e.g., BBCA)
        days: Lookback period for backtest (default 180 = ~6 months)
    
    Returns:
        Backtest statistics including win rate, avg return, total trades, etc.
    """
    try:
        from modules.backtest_engine import BacktestEngine
        
        decoded_symbol = urllib.parse.unquote(symbol).upper()
        engine = BacktestEngine()
        results = engine.run_backtest(decoded_symbol, days)
        
        if "error" in results:
            raise HTTPException(status_code=404, detail=results["error"])
        
        return results
    except HTTPException:
        raise  # Re-raise HTTPException (404) without converting to 500
    except Exception as e:
        print(f"Backtest error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/forecast/{symbol}/insight")
async def get_ai_insight(symbol: str):
    """
    Generate AI-powered analyst insight for the given symbol.
    Uses local Ollama LLM (Llama 3.2 or configured model).
    
    Args:
        symbol: Stock ticker (e.g., BBCA)
    
    Returns:
        JSON with 'insight' field containing 3-4 sentence analysis in Indonesian
    """
    try:
        from modules.llm_service import LLMService
        
        decoded_symbol = urllib.parse.unquote(symbol).upper()
        
        # Get forecast data first
        forecast = forecaster.get_forecast(decoded_symbol)
        
        if "error" in forecast:
            raise HTTPException(status_code=404, detail=forecast["error"])
        
        # Prepare LLM context
        context = forecaster.get_llm_context(decoded_symbol, forecast)
        
        # Generate insight
        llm = LLMService()
        insight = llm.generate_analyst_insight(context)
        
        return {
            "symbol": decoded_symbol,
            "insight": insight,
            "model": llm.model_name
        }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"AI Insight error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
