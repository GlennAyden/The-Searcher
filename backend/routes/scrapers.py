"""Scraper routes for triggering news and disclosure scrapers."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api", tags=["scrapers"])


class ScrapeRequest(BaseModel):
    """Request model for scraper endpoints."""
    source: str
    start_date: str
    end_date: str
    ticker: Optional[str] = None
    scrape_all_history: Optional[bool] = False


@router.post("/scrape")
async def run_scraper(request: ScrapeRequest):
    """
    Execute news/disclosure scrapers based on source.
    
    Supported sources:
    - "EmitenNews": Scrape from emitennews.com
    - "CNBC Indonesia": Scrape from cnbcindonesia.com
    - "Bisnis.com": Scrape from bisnis.com market section
    - "Investor.id": Scrape from investor.id (corporate-action + market)
    - "IDX (Keterbukaan Informasi)": Scrape IDX disclosures
    
    Args:
        request: Scraper configuration including source, date range, and ticker
    
    Returns:
        Status, message, and count of new items scraped
    """
    try:
        from modules.database import DatabaseManager
        from modules.analyzer import SentimentEngine
        from modules.utils import extract_tickers
        
        db_manager = DatabaseManager()
        
        # Parse dates
        start_dt = datetime.fromisoformat(request.start_date)
        end_dt = datetime.fromisoformat(request.end_date)
        
        new_count = 0
        message = ""
        
        if request.source == "EmitenNews":
            from modules.scraper_emiten import EmitenNewsScraper
            scraper = EmitenNewsScraper()
            new_articles = scraper.run(start_dt, end_dt)
            
            if new_articles:
                engine = SentimentEngine()
                analyzed_data = engine.process_and_save(new_articles)
                
                # Enrich with ticker extraction
                for article in analyzed_data:
                    if 'ticker' not in article or not article['ticker']:
                        article['ticker'] = extract_tickers(article.get('title', ''))
                
                db_manager.save_news(analyzed_data)
                new_count = len(analyzed_data)
                message = f"Berhasil mengambil {new_count} berita dari EmitenNews."
            else:
                message = "Tidak ada berita baru ditemukan di EmitenNews."

        elif request.source == "CNBC Indonesia":
            from modules.scraper_cnbc import CNBCScraper
            scraper = CNBCScraper()
            # CNBC scraper already runs analysis internally
            analyzed_data = scraper.run(start_date=start_dt, end_date=end_dt)
            
            if analyzed_data:
                db_manager.save_news(analyzed_data)
                new_count = len(analyzed_data)
                message = f"Berhasil mengambil {new_count} berita dari CNBC Indonesia."
            else:
                message = "Tidak ada berita baru ditemukan di CNBC Indonesia."

        elif request.source == "IDX (Keterbukaan Informasi)":
            from modules.scraper_idx import fetch_and_save_pipeline
            
            final_start = start_dt.date()
            final_end = end_dt.date()
            
            if request.ticker and request.scrape_all_history:
                final_start = datetime(2010, 1, 1).date()
                final_end = datetime.now().date()
            
            fetch_and_save_pipeline(
                ticker=request.ticker if request.ticker and request.ticker.strip() != "" else None,
                start_date=final_start,
                end_date=final_end,
                download_dir="downloads"
            )
            
            # Auto-run Indexing
            from idx_processor import IDXProcessor
            processor = IDXProcessor()
            processor.run_processor()
            
            message = "Pipeline IDX Selesai. Data telah terdownload dan terindeks untuk RAG."
            new_count = -1  # Special code for IDX
            
        elif request.source == "Bisnis.com":
            from modules.scraper_bisnis import BisnisScraper
            scraper = BisnisScraper()
            # Bisnis scraper already runs analysis internally
            analyzed_data = scraper.run(start_date=start_dt, end_date=end_dt)
            
            if analyzed_data:
                db_manager.save_news(analyzed_data)
                new_count = len(analyzed_data)
                message = f"Berhasil mengambil {new_count} berita dari Bisnis.com."
            else:
                message = "Tidak ada berita baru ditemukan di Bisnis.com."

        elif request.source == "Investor.id":
            from modules.scraper_investor import InvestorScraper
            scraper = InvestorScraper()
            # Investor scraper already runs analysis internally
            analyzed_data = scraper.run(start_date=start_dt, end_date=end_dt)
            
            if analyzed_data:
                db_manager.save_news(analyzed_data)
                new_count = len(analyzed_data)
                message = f"Berhasil mengambil {new_count} berita dari Investor.id."
            else:
                message = "Tidak ada berita baru ditemukan di Investor.id."

        else:
            return JSONResponse(
                status_code=400,
                content={"error": f"Sumber tidak dikenal: {request.source}"}
            )

        return {
            "status": "success",
            "message": message,
            "new_count": new_count
        }
        
    except Exception as e:
        print(f"Scrape Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
