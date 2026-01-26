"""
Alpha Hunter Service Layer.

Orchestrates the existing Alpha Hunter modules for multi-stage analysis.
This service wraps the modules in modules/alpha_hunter_*.py providing
a clean interface for the routes.

Eventually, those modules can be migrated here as the codebase evolves.
"""
from typing import Dict, List, Optional
from datetime import datetime


class AlphaHunterService:
    """Service layer for Alpha Hunter operations."""
    
    def __init__(self):
        # Lazy import modules to avoid circular imports
        self._scorer = None
        self._vpa = None
        self._flow = None
        self._supply = None
        self._health = None
    
    @property
    def scorer(self):
        if self._scorer is None:
            from modules.alpha_hunter_scorer import AlphaHunterScorer
            self._scorer = AlphaHunterScorer()
        return self._scorer
    
    @property
    def vpa(self):
        if self._vpa is None:
            from modules.alpha_hunter_vpa import AlphaHunterVPA
            self._vpa = AlphaHunterVPA()
        return self._vpa
    
    @property
    def flow(self):
        if self._flow is None:
            from modules.alpha_hunter_flow import AlphaHunterFlow
            self._flow = AlphaHunterFlow()
        return self._flow
    
    @property
    def supply(self):
        if self._supply is None:
            from modules.alpha_hunter_supply import AlphaHunterSupply
            self._supply = AlphaHunterSupply()
        return self._supply
    
    # ========================================================================
    # Stage 1: Screening
    # ========================================================================
    
    def scan_anomalies(
        self,
        min_score: int = 60,
        sector: str = None,
        max_tickers: Optional[int] = 100,
        max_runtime_sec: Optional[int] = 20,
        use_market_cap: bool = False
    ) -> List[Dict]:
        """[Stage 1 Legacy] Scan market for volume anomalies."""
        return self.scorer.scan_market(
            min_score=min_score,
            sector=sector,
            max_tickers=max_tickers,
            max_runtime_sec=max_runtime_sec,
            use_market_cap=use_market_cap
        )
    
    def scan_flow_signals(
        self,
        min_score: int = 50,
        method: str = 'm',
        flow_direction: str = None,
        price_filter: float = None,
        price_operator: str = None,
        max_results: int = 20
    ) -> Dict:
        """[Stage 1] Flow-based screening using NeoBDM hot signals."""
        return self.flow.scan(
            min_score=min_score,
            method=method,
            flow_direction=flow_direction,
            price_filter=price_filter,
            price_operator=price_operator,
            max_results=max_results
        )
    
    # ========================================================================
    # Stage 2: VPA Analysis
    # ========================================================================
    
    def get_vpa_analysis(
        self,
        ticker: str,
        lookback_days: int = 20,
        spike_date: str = None,
        min_ratio: float = 2.0
    ) -> Dict:
        """[Stage 2] Get VPA analysis for a ticker."""
        return self.vpa.analyze(
            ticker=ticker,
            lookback_days=lookback_days,
            spike_date=spike_date,
            min_ratio=min_ratio
        )
    
    def get_vpa_visualization(self, ticker: str, selling_climax_date: str = None) -> Dict:
        """[Stage 2] Get VPA visualization data for charts."""
        return self.vpa.get_visualization(ticker, selling_climax_date)
    
    def get_pullback_health(self, ticker: str, spike_date: str = None) -> Dict:
        """[Stage 2] Analyze pullback health after a spike."""
        from modules.alpha_hunter_health import analyze_pullback_health
        return analyze_pullback_health(ticker, spike_date)
    
    # ========================================================================
    # Stage 3: Smart Money Flow
    # ========================================================================
    
    def get_smart_money_flow(self, ticker: str, days: int = 7) -> Dict:
        """[Stage 3] Get smart money flow analysis."""
        return self.flow.get_smart_money_flow(ticker, days)
    
    # ========================================================================
    # Stage 4: Supply Analysis
    # ========================================================================
    
    def get_supply_analysis(
        self,
        ticker: str,
        start_date: str = None,
        end_date: str = None
    ) -> Dict:
        """[Stage 4] Get supply analysis."""
        return self.supply.analyze(ticker, start_date, end_date)
    
    # ========================================================================
    # Watchlist Management
    # ========================================================================
    
    def get_watchlist(self) -> List[Dict]:
        """Get active investigation watchlist."""
        from modules.database import DatabaseManager
        db = DatabaseManager()
        return db.get_watchlist()
    
    def manage_watchlist(
        self,
        ticker: str,
        action: str,
        scan_data: Dict = None
    ) -> Dict:
        """Add/remove items from watchlist."""
        from modules.database import DatabaseManager
        db = DatabaseManager()
        
        if action == 'add':
            db.add_to_watchlist(ticker, scan_data)
            return {"status": "added", "ticker": ticker}
        elif action == 'remove':
            db.remove_from_watchlist(ticker)
            return {"status": "removed", "ticker": ticker}
        elif action == 'import_scan':
            db.import_scan_to_watchlist(scan_data)
            return {"status": "imported", "count": len(scan_data) if scan_data else 0}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}
    
    def update_stage(self, ticker: str, stage: int) -> Dict:
        """Update investigation stage for a ticker."""
        from modules.database import DatabaseManager
        db = DatabaseManager()
        db.update_watchlist_stage(ticker, stage)
        return {"status": "updated", "ticker": ticker, "stage": stage}


# Singleton instance for convenience
alpha_hunter_service = AlphaHunterService()
