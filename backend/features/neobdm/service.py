"""
NeoBDM Service Layer.

Orchestrates repository calls with analysis modules.
This is the main interface for NeoBDM operations.
"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from .repository import NeoBDMRepository
from .analysis import (
    BrokerSummaryAnalyzer,
    FloorPriceAnalyzer,
    SignalsAnalyzer
)
from modules.database import DatabaseManager


class NeoBDMService:
    """Service layer for NeoBDM operations."""
    
    def __init__(self):
        self.repository = NeoBDMRepository()
        self.broker_analyzer = BrokerSummaryAnalyzer()
        self.floor_analyzer = FloorPriceAnalyzer()
        self.signals_analyzer = SignalsAnalyzer()
    
    # ========================================================================
    # CRUD Operations (delegate to repository)
    # ========================================================================
    
    def save_neobdm_summary(self, method: str, period: str, data_list: List[Dict]) -> None:
        return self.repository.save_neobdm_summary(method, period, data_list)
    
    def save_neobdm_record_batch(self, method: str, period: str, data_list: List[Dict], scraped_at: str = None) -> int:
        return self.repository.save_neobdm_record_batch(method, period, data_list, scraped_at)
    
    def save_broker_summary_batch(self, ticker: str, trade_date: str, buy_data: List[Dict], sell_data: List[Dict]) -> int:
        return self.repository.save_broker_summary_batch(ticker, trade_date, buy_data, sell_data)
    
    def get_broker_summary(self, ticker: str, trade_date: str) -> Dict:
        return self.repository.get_broker_summary(ticker, trade_date)
    
    def get_available_dates_for_ticker(self, ticker: str) -> List[str]:
        return self.repository.get_available_dates_for_ticker(ticker)
    
    def get_neobdm_tickers(self) -> List[str]:
        return self.repository.get_neobdm_tickers()
    
    def get_available_neobdm_dates(self) -> List[str]:
        return self.repository.get_available_neobdm_dates()
    
    # ========================================================================
    # Broker Journey Analysis
    # ========================================================================
    
    def get_broker_journey(
        self,
        ticker: str,
        brokers: List[str],
        start_date: str,
        end_date: str,
        price_data: List[Dict] = None
    ) -> Dict:
        """Get broker journey data showing patterns over time."""
        db_manager = DatabaseManager()
        return db_manager.get_broker_journey(ticker, brokers, start_date, end_date)
    
    def get_top_holders_by_net_lot(self, ticker: str, limit: int = 3) -> List[Dict]:
        """Get top holders based on cumulative net lot."""
        db_manager = DatabaseManager()
        return db_manager.get_top_holders_by_net_lot(ticker, limit)
    
    # ========================================================================
    # Floor Price Analysis
    # ========================================================================
    
    def get_floor_price_analysis(self, ticker: str, days: int = 30) -> Dict:
        """Calculate floor price from institutional broker data."""
        db_manager = DatabaseManager()
        return db_manager.get_floor_price_analysis(ticker, days)
    
    # ========================================================================
    # Hot Signals Analysis
    # ========================================================================
    
    def get_latest_hot_signals(self, method: str = 'm') -> List[Dict]:
        """Get hot signals with multi-factor scoring."""
        db_manager = DatabaseManager()
        return db_manager.get_latest_hot_signals()
    
    # ========================================================================
    # Volume Operations
    # ========================================================================
    
    def save_volume_batch(self, ticker: str, records: List[Dict]) -> int:
        return self.repository.save_volume_batch(ticker, records)
    
    def get_volume_history(self, ticker: str, start_date: str = None, end_date: str = None) -> List[Dict]:
        return self.repository.get_volume_history(ticker, start_date, end_date)
    
    def get_latest_volume_date(self, ticker: str) -> Optional[str]:
        return self.repository.get_latest_volume_date(ticker)
    
    # ========================================================================
    # Background Sync Operations (extracted from routes/neobdm.py)
    # ========================================================================
    
    async def perform_full_sync(self):
        """
        Full synchronization of all NeoBDM data.
        Each method+period combination gets a fresh browser session.
        """
        import asyncio
        from datetime import datetime
        
        try:
            from modules.scraper_neobdm import NeoBDMScraper
            
            methods = [('m', 'Market Maker'), ('nr', 'Non-Retail'), ('f', 'Foreign Flow')]
            periods = [('d', 'Daily'), ('c', 'Cumulative')]
            
            start_time = datetime.now()
            today_str = start_time.strftime('%Y-%m-%d')
            execution_log = []
            
            print(f"[*] Starting background Full Sync at {start_time}")
            print(f"[*] Using ISOLATED SESSION approach (6 separate logins)")
            
            for m_code, m_label in methods:
                for p_code, p_label in periods:
                    log_prefix = f"[{m_label}/{p_label}]"
                    print(f"\n{log_prefix} Starting isolated scraping session...")
                    
                    scraper = NeoBDMScraper()
                    
                    try:
                        print(f"{log_prefix} Initializing browser...", flush=True)
                        await scraper.init_browser(headless=True)
                        
                        print(f"{log_prefix} Logging in...", flush=True)
                        login_success = await scraper.login()
                        
                        if not login_success:
                            msg = "Login failed"
                            print(f"{log_prefix} Result: {msg}")
                            execution_log.append(f"{log_prefix}: {msg}")
                            continue
                        
                        # Cleanup old data for today
                        try:
                            self._cleanup_today_records(m_code, p_code, today_str)
                        except Exception as e:
                            print(f"{log_prefix} Cleanup warning: {e}")
                        
                        # Scrape
                        print(f"{log_prefix} Scraping data...", flush=True)
                        try:
                            df, reference_date = await scraper.get_market_summary(method=m_code, period=p_code)
                            
                            if df is not None and not df.empty:
                                data_list = df.to_dict(orient="records")
                                scraped_at = reference_date if reference_date else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                self.repository.save_neobdm_record_batch(m_code, p_code, data_list, scraped_at=scraped_at)
                                msg = f"Success ({len(df)} rows)"
                            else:
                                msg = "No data found"
                        except Exception as e:
                            import traceback
                            print(f"{log_prefix} Scraping error: {traceback.format_exc()}")
                            msg = f"Error: {str(e)}"
                        
                        print(f"{log_prefix} Result: {msg}")
                        execution_log.append(f"{log_prefix}: {msg}")
                        
                    except Exception as e:
                        msg = f"Session error: {str(e)}"
                        print(f"{log_prefix} {msg}")
                        execution_log.append(f"{log_prefix}: {msg}")
                        
                    finally:
                        print(f"{log_prefix} Closing browser session...", flush=True)
                        await scraper.close()
                    
                    await asyncio.sleep(2)
                
            duration = datetime.now() - start_time
            print(f"\n[*] Background Full Sync completed in {duration.total_seconds():.2f}s.")
            print(f"[*] Logs: {execution_log}")
            
        except Exception as e:
            print(f"[!] Critical error in background sync: {e}")
            import logging
            logging.error(f"Critical error in background sync: {e}")
    
    def _cleanup_today_records(self, method: str, period: str, today_str: str):
        """Delete today's records for a method/period before re-scraping."""
        from db.connection import BaseRepository
        conn = BaseRepository()._get_conn()
        try:
            conn.execute(
                "DELETE FROM neobdm_records WHERE method=? AND period=? AND scraped_at LIKE ?",
                (method, period, f"{today_str}%")
            )
            conn.commit()
        finally:
            conn.close()
    
    async def perform_broker_summary_batch_sync(self, tasks: List[Dict]):
        """Background task for batch broker summary sync."""
        import logging
        from modules.scraper_neobdm import NeoBDMScraper
        
        scraper = NeoBDMScraper()
        
        try:
            await scraper.init_browser(headless=True)
            results = await scraper.get_broker_summary_batch(tasks)
            success_count = 0
            error_count = 0
            
            for res in results:
                if "error" not in res:
                    self.repository.save_broker_summary_batch(
                        ticker=res['ticker'],
                        trade_date=res['trade_date'],
                        buy_data=res['buy'],
                        sell_data=res['sell']
                    )
                    success_count += 1
                else:
                    error_count += 1
                    logging.warning(f"[!] Batch error for {res.get('ticker')} on {res.get('trade_date')}: {res.get('error')}")
            
            print(f"[*] Batch Broker Summary Sync completed. {success_count} saved, {error_count} errors.")
            
        except Exception as e:
            logging.error(f"Error in background batch broker summary sync: {e}")
        finally:
            await scraper.close()


# Singleton instance for convenience
neobdm_service = NeoBDMService()
