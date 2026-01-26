# features/done_detail/__init__.py
"""
Done Detail Feature Module

Provides trade data analysis from pasted Done Detail records.

Components:
- repository: CRUD operations for trade records and synthesis
- service: Business logic orchestration
- analysis/: Imposter, Speed, Combined, and Visualization analysis
"""
from .repository import DoneDetailRepository
from .service import DoneDetailService

__all__ = [
    "DoneDetailRepository",
    "DoneDetailService",
]
