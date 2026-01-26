"""
Backend Routes Module

This module exports all FastAPI routers for the Market Intelligence System.
Each router handles a specific domain of functionality:

- dashboard_router: Market statistics and overview endpoints
- news_router: News articles and sentiment analysis endpoints  
- disclosures_router: IDX disclosures and RAG chat endpoints
- neobdm_router: Market maker and fund flow analysis endpoints
- broker_five_router: Broker 5% list endpoints
- done_detail_router: Done detail visualization and broker flow
- price_volume_router: OHLCV candlestick and volume analysis
- alpha_hunter_router: Alpha Hunter flow-based screening
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
from .scrapers import router as scrapers_router
from .broker_five import router as broker_five_router
from .done_detail import router as done_detail_router
from .price_volume import router as price_volume_router
from .alpha_hunter import router as alpha_hunter_router

__all__ = [
    "dashboard_router",
    "news_router", 
    "disclosures_router",
    "neobdm_router",
    "scrapers_router",
    "broker_five_router",
    "done_detail_router",
    "price_volume_router",
    "alpha_hunter_router",
]

