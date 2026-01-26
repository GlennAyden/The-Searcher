# features/scrapers/__init__.py
"""
Scrapers Feature Module

News and data scrapers for Indonesian financial sources.

Components:
- base: BaseScraper with common functionality
- Individual scrapers inherit from BaseScraper
"""
from .base import BaseScraper

__all__ = [
    "BaseScraper",
]
