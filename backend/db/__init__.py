"""
Database Repository Module

This module exports all database repositories and connection utilities
for the Market Intelligence System.

Architecture:
- BaseRepository: Abstract base class providing shared SQLite connection logic
- DatabaseConnection: Centralized schema management and table creation
- Domain-specific repositories: NewsRepository, DisclosureRepository, etc.

Each repository encapsulates database operations for its specific domain,
following the Repository pattern for better separation of concerns.

Usage:
    from db import NewsRepository, DatabaseConnection
    
    db_conn = DatabaseConnection()  # Initialize schema
    news_repo = NewsRepository()    # Use repository
    news = news_repo.get_news(ticker='BBCA')
"""
from .connection import BaseRepository, DatabaseConnection
from .news_repository import NewsRepository
from .disclosure_repository import DisclosureRepository
from .neobdm_repository import NeoBDMRepository
from .running_trade_repository import RunningTradeRepository

__all__ = [
    "BaseRepository",
    "DatabaseConnection",
    "NewsRepository",
    "DisclosureRepository",
    "NeoBDMRepository",
    "RunningTradeRepository"
]
