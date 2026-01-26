"""
Main FastAPI Application - Market Intelligence System

Refactored to use modular routers for better maintainability.
All endpoints are now organized into domain-specific routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import sys
import asyncio

# Force ProactorEventLoop on Windows for Playwright compatibility
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # Patch to silence "WinError 10054 An existing connection was forcibly closed"
    # This is a known issue with asyncio ProactorEventLoop on Windows
    try:
        from asyncio import proactor_events
        _original_connection_lost = proactor_events._ProactorBasePipeTransport._call_connection_lost
        
        def _silent_connection_lost(self, exc=None):
            try:
                _original_connection_lost(self, exc)
            except ConnectionResetError:
                pass
            except OSError as e:
                if getattr(e, 'winerror', 0) == 10054:
                    pass
                else:
                    raise
        
        proactor_events._ProactorBasePipeTransport._call_connection_lost = _silent_connection_lost
    except ImportError:
        pass

# Import all routers
from routes.dashboard import router as dashboard_router
from routes.news import router as news_router
from routes.disclosures import router as disclosures_router
from routes.scrapers import router as scrapers_router
from routes.neobdm import router as neobdm_router

from routes.broker_five import router as broker_five_router
from routes.done_detail import router as done_detail_router
from routes.price_volume import router as price_volume_router
from routes.alpha_hunter import router as alpha_hunter_router

# Create FastAPI app
app = FastAPI(
    title="Financial Sentiment Analysis & Market Intelligence API",
    description="Comprehensive market intelligence system with sentiment analysis and flow tracking",
    version="2.0.0"
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # More permissive for local network/dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression for large JSON responses (70-80% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.on_event("startup")
async def startup_event():
    """Run synchronization and cleanup on server startup."""
    try:
        # Verify Event Loop Policy
        if sys.platform == "win32":
            policy = asyncio.get_event_loop_policy()
            logging.info(f"Current Event Loop Policy: {policy}")
            loop = asyncio.get_running_loop()
            logging.info(f"Running Event Loop: {type(loop)}")

        from modules.sync_utils import sync_disclosures_with_filesystem
        logger = logging.getLogger("uvicorn")
        logger.info("Starting Database-Filesystem sync...")
        result = sync_disclosures_with_filesystem()
        logger.info(f"Sync Result: {result['message']}")
        
        # Run Done Detail cleanup (7-day grace period for raw data)
        try:
            from db import DoneDetailRepository
            done_detail_repo = DoneDetailRepository()
            cleaned = done_detail_repo.delete_old_raw_data(days=7)
            if cleaned > 0:
                logger.info(f"Done Detail Cleanup: Deleted {cleaned} raw records older than 7 days")
        except Exception as cleanup_err:
            logger.warning(f"Done Detail cleanup skipped: {cleanup_err}")
            
    except Exception as e:
        logging.error(f"Startup sync failed: {e}")


@app.get("/")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "message": "Financial Sentiment Analysis & Market Intelligence API is running",
        "version": "2.0.0",
        "features": {
            "dashboard": "Market statistics and sentiment correlation",
            "news": "News aggregation with AI insights",
            "disclosures": "IDX disclosures and RAG chat",
            "neobdm": "Market maker and fund flow analysis",

            "done_detail": "Done detail visualization and broker flow",
            "scrapers": "Automated data collection"
        }
    }


# Register all routers
app.include_router(dashboard_router)
app.include_router(news_router)
app.include_router(disclosures_router)
app.include_router(scrapers_router)
app.include_router(neobdm_router)

app.include_router(broker_five_router)
app.include_router(done_detail_router)
app.include_router(price_volume_router)
app.include_router(alpha_hunter_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
