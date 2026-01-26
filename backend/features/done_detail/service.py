"""
Done Detail Service Layer.

Orchestrates repository calls with analysis modules.
This is the main interface for Done Detail operations.
"""
from typing import Dict, List, Optional
from .repository import DoneDetailRepository
from .analysis import (
    ImposterAnalyzer,
    SpeedAnalyzer,
    CombinedAnalyzer,
    VisualizationAnalyzer
)


class DoneDetailService:
    """Service layer for Done Detail operations."""
    
    def __init__(self):
        self.repository = DoneDetailRepository()
        self.imposter_analyzer = ImposterAnalyzer()
        self.speed_analyzer = SpeedAnalyzer()
        self.combined_analyzer = CombinedAnalyzer()
        self.visualization_analyzer = VisualizationAnalyzer()
    
    # ========================================================================
    # CRUD Operations (delegate to repository)
    # ========================================================================
    
    def check_exists(self, ticker: str, trade_date: str) -> bool:
        return self.repository.check_exists(ticker, trade_date)
    
    def save_records(self, ticker: str, trade_date: str, records: List[Dict]) -> int:
        return self.repository.save_records(ticker, trade_date, records)
    
    def get_records(self, ticker: str, trade_date: str):
        return self.repository.get_records(ticker, trade_date)
    
    def get_saved_history(self):
        return self.repository.get_saved_history()
    
    def delete_records(self, ticker: str, trade_date: str) -> bool:
        return self.repository.delete_records(ticker, trade_date)
    
    def get_available_tickers(self) -> List[str]:
        return self.repository.get_available_tickers()
    
    def get_date_range(self, ticker: str) -> Dict:
        return self.repository.get_date_range(ticker)
    
    def delete_old_raw_data(self, days: int = 7) -> int:
        return self.repository.delete_old_raw_data(days)
    
    # ========================================================================
    # Synthesis Operations
    # ========================================================================
    
    def check_synthesis_exists(self, ticker: str, trade_date: str) -> bool:
        return self.repository.check_synthesis_exists(ticker, trade_date)
    
    def get_synthesis(self, ticker: str, trade_date: str) -> Optional[Dict]:
        return self.repository.get_synthesis(ticker, trade_date)
    
    def delete_synthesis(self, ticker: str, trade_date: str) -> None:
        return self.repository.delete_synthesis(ticker, trade_date)
    
    def compute_and_save_synthesis(self, ticker: str, trade_date: str) -> Dict:
        """Compute all analyses and save as synthesis."""
        # Get raw data
        df = self.repository.get_records_range(ticker, trade_date, trade_date)
        
        if df.empty:
            return {"error": "No data found"}
        
        # Run analyses
        imposter_data = self.detect_imposter_trades(ticker, trade_date, trade_date)
        speed_data = self.analyze_speed(ticker, trade_date, trade_date)
        combined_data = self.get_combined_analysis(ticker, trade_date, trade_date)
        
        # Save synthesis
        self.repository.save_synthesis(
            ticker=ticker,
            trade_date=trade_date,
            imposter_data=imposter_data,
            speed_data=speed_data,
            combined_data=combined_data,
            raw_record_count=len(df)
        )
        
        # Mark raw data as processed
        self.repository.mark_raw_as_processed(ticker, trade_date)
        
        return {
            "success": True,
            "trade_date": trade_date,
            "record_count": len(df)
        }
    
    # ========================================================================
    # Analysis Operations
    # ========================================================================
    
    def detect_imposter_trades(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Detect imposter trades in date range."""
        df = self.repository.get_records_range(ticker, start_date, end_date)
        return self.imposter_analyzer.detect_imposter_trades(df, ticker, start_date, end_date)
    
    def analyze_speed(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Analyze trading speed in date range."""
        df = self.repository.get_records_range(ticker, start_date, end_date)
        return self.speed_analyzer.analyze_speed(df, ticker, start_date, end_date)
    
    def get_combined_analysis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Get combined imposter + speed analysis."""
        imposter_data = self.detect_imposter_trades(ticker, start_date, end_date)
        speed_data = self.analyze_speed(ticker, start_date, end_date)
        return self.combined_analyzer.get_combined_analysis(
            imposter_data, speed_data, ticker, start_date, end_date
        )
    
    def get_range_analysis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Get range analysis from synthesis data."""
        synthesis_list = self.repository.get_synthesis_range(ticker, start_date, end_date)
        return self.combined_analyzer.get_range_analysis_from_synthesis(
            synthesis_list, ticker, start_date, end_date
        )
    
    # ========================================================================
    # Visualization Operations
    # ========================================================================
    
    def get_sankey_data(self, ticker: str, trade_date: str) -> Dict:
        """Get Sankey diagram data."""
        flow_df = self.repository.get_trade_flow_data(ticker, trade_date)
        return self.visualization_analyzer.get_sankey_data(flow_df)
    
    def get_inventory_data(self, ticker: str, trade_date: str) -> Dict:
        """Get inventory chart data."""
        ts_df = self.repository.get_time_series_data(ticker, trade_date)
        return self.visualization_analyzer.get_inventory_data(ts_df)
    
    def get_accum_dist_analysis(self, ticker: str, trade_date: str) -> Dict:
        """Get accumulation/distribution analysis."""
        flows_df = self.repository.get_broker_flows(ticker, trade_date)
        return self.visualization_analyzer.get_accum_dist_analysis(flows_df)


# Singleton instance for convenience
done_detail_service = DoneDetailService()
