"""
Backend Routes Module

This module exports all FastAPI routers for the Market Intelligence System.
Each router handles a specific domain of functionality:

- dashboard_router: Market statistics and overview endpoints
- news_router: News articles and sentiment analysis endpoints  
- disclosures_router: IDX disclosures and RAG chat endpoints
- neobdm_router: Market maker and fund flow analysis endpoints
- running_trade_router: Real-time trade monitoring endpoints
- scrapers_router: Data scraping trigger endpoints

Usage:
    from routes import dashboard_router, news_router
    
    app.include_router(dashboard_router)
    app.include_router(news_router)
"""
from fastapi import APIRouter

from .dashboard import router as dashboard_router
from .news import router as news_router
from .disclosures import router as disclosures_router
from .neobdm import router as neobdm_router
from .running_trade import router as running_trade_router
from .scrapers import router as scrapers_router

__all__ = [
    "dashboard_router",
    "news_router", 
    "disclosures_router",
    "neobdm_router",
    "running_trade_router",
    "scrapers_router"
]
