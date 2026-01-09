"""
Market Forecaster Module
The "Brain" that orchestrates:
1. Fetching Flow Data (NeoBDM)
2. Fetching Market Data (OHLCV)
3. Running Technical Analysis
4. Producing a Trade Plan
"""
from modules.market_data import MarketData
from modules.technical_analyst import TechnicalAnalyst
from db.neobdm_repository import NeoBDMRepository
from typing import Dict
import pandas as pd
import numpy as np

class MarketForecaster:
    def __init__(self, db_path=None):
        self.market_data = MarketData(db_path)
        self.analyst = TechnicalAnalyst()
        self.neobdm_repo = NeoBDMRepository(db_path)
        
    def get_forecast(self, symbol: str):
        """
        Generate full forecast for a symbol.
        """
        # 1. Fetch OHLCV Data (1 Year)
        print(f"DEBUG: Fetching OHLCV data for {symbol}")
        df = self.market_data.fetch_ohlcv(symbol, days=365)
        
        if df.empty:
            print(f"DEBUG: No market data found for {symbol}")
            return {
                "symbol": symbol,
                "error": "No market data found"
            }
            
        # 2. Fetch NeoBDM Data (Latest Flow)
        # Use existing logic to get latest 1 record for summary
        # We can implement a method in repo or just query specifically if needed.
        # For now, let's assume we fetch history and take latest.
        flow_history = self.neobdm_repo.get_neobdm_history(symbol, limit=1)
        latest_flow = flow_history[0] if flow_history else {}
        
        # 3. Technical Analysis
        current_price = df['close'].iloc[-1]
        supports, resistances = self.analyst.find_support_resistance(df)
        atr = self.analyst.calculate_atr(df)
        
        # 4. Generate Trade Plan
        plan = self.analyst.generate_trade_plan(current_price, supports, resistances, atr)
        
        # 5. Format Response
        # Convert OHLCV to list of dicts for frontend chart
        # Reset index to get date as column
        df_chart = df.reset_index()
        # Ensure date is string
        if 'date' in df_chart.columns:
            df_chart['date'] = df_chart['date'].dt.strftime('%Y-%m-%d')
            
        chart_data = df_chart[['date', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
        
        # Filter to 2 closest supports and 2 closest resistances for cleanliness
        closest_supports = sorted([s for s in supports if s < current_price], reverse=True)[:2]
        closest_resistances = sorted([r for r in resistances if r > current_price])[:2]
        
        print(f"DEBUG: Ticker {symbol} -> S: {len(closest_supports)}, R: {len(closest_resistances)}")
        
        return {
            "symbol": symbol,
            "current_price": current_price,
            "flow_data": latest_flow,
            "technical_analysis": {
                "supports": [int(s) for s in closest_supports],
                "resistances": [int(r) for r in closest_resistances],
                "atr": round(atr, 2)
            },
            "trade_plan": plan,
            "chart_data": chart_data
        }
    
    def get_llm_context(self, symbol: str, forecast_data: Dict) -> Dict:
        """
        Prepare structured context for LLM insight generation.
        
        Args:
            symbol: Stock ticker
            forecast_data: Output from get_forecast()
        
        Returns:
            Dictionary formatted for LLM prompt injection
        """
        current_price = forecast_data["current_price"]
        plan = forecast_data["trade_plan"]
        flow = forecast_data.get("flow_data", {})
        tech = forecast_data["technical_analysis"]
        
        # Get nearest support/resistance
        support = tech["supports"][0] if tech["supports"] else current_price * 0.95
        resistance = tech["resistances"][0] if tech["resistances"] else current_price * 1.05
        
        # Calculate distance to support
        distance_to_support = ((current_price - support) / current_price) * 100
        
        # Format flow summary
        net_flow = flow.get("net_flow_value", 0)
        if net_flow > 0:
            flow_summary = f"Net buy Rp {net_flow/1e9:.1f}B (5 hari terakhir)"
        elif net_flow < 0:
            flow_summary = f"Net sell Rp {abs(net_flow)/1e9:.1f}B (5 hari terakhir)"
        else:
            flow_summary = "No significant flow detected"
        
        return {
            "symbol": symbol,
            "current_price": current_price,
            "action": plan["action"],
            "support": support,
            "resistance": resistance,
            "distance_to_support": distance_to_support,
            "flow_summary": flow_summary,
            "success_probability": plan.get("success_probability", 50),
            "entry_zone": plan["entry_zone"],
            "targets": plan["targets"],
            "stop_loss": plan["stop_loss"]
        }
