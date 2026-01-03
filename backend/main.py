"""
Main FastAPI Application - Market Intelligence System

Refactored to use modular routers for better maintainability.
All endpoints are now organized into domain-specific routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Import all routers
from routes.dashboard import router as dashboard_router
from routes.news import router as news_router
from routes.disclosures import router as disclosures_router
from routes.scrapers import router as scrapers_router
from routes.neobdm import router as neobdm_router
from routes.running_trade import router as running_trade_router

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
