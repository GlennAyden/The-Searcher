# features/alpha_hunter/__init__.py
"""
Alpha Hunter Feature Module

Multi-stage analysis system for finding trading opportunities.

Stages:
- Stage 1: Flow-based screening (NeoBDM hot signals)
- Stage 2: VPA (Volume Price Analysis) 
- Stage 3: Smart money flow analysis
- Stage 4: Supply analysis

Components:
- service: Main orchestration layer
- Modules from modules/alpha_hunter_*.py are used directly for now
"""
from .service import AlphaHunterService

__all__ = [
    "AlphaHunterService",
]
