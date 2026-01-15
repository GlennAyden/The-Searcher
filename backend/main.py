"""
Main FastAPI Application - Market Intelligence System

Refactored to use modular routers for better maintainability.
All endpoints are now organized into domain-specific routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys
import asyncio

# Force ProactorEventLoop on Windows for Playwright compatibility
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Import all routers
from routes.dashboard import router as dashboard_router
from routes.news import router as news_router
from routes.disclosures import router as disclosures_router
from routes.scrapers import router as scrapers_router
from routes.neobdm import router as neobdm_router
from routes.running_trade import router as running_trade_router
from routes.forecasting import router as forecasting_router
from routes.broker_five import router as broker_five_router

# Create FastAPI app
app = FastAPI(
    title="Financial Sentiment Analysis & Market Intelligence API",
    description="Comprehensive market intelligence system with sentiment analysis, flow tracking, and real-time trade monitoring",
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


@app.on_event("startup")
async def startup_event():
    """Run synchronization on server startup."""
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
            "running_trade": "Real-time trade monitoring",
            "scrapers": "Automated data collection"
        }
    }


# Register all routers
app.include_router(dashboard_router)
app.include_router(news_router)
app.include_router(disclosures_router)
app.include_router(scrapers_router)
app.include_router(neobdm_router)
app.include_router(running_trade_router)
app.include_router(forecasting_router, prefix="/api")
app.include_router(broker_five_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
