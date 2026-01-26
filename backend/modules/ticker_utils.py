"""
DEPRECATED: This module is deprecated. Import from shared.utils.ticker_utils instead.

This file is kept for backward compatibility only.
All functionality has been moved to shared/utils/ticker_utils.py.

Usage (new):
    from shared.utils.ticker_utils import get_ticker_list, get_ticker_map
    
Usage (legacy - still works):
    from modules.ticker_utils import get_ticker_list, get_ticker_map
"""
# Re-export everything from new location
from shared.utils.ticker_utils import (
    reload_cache,
    get_ticker_map,
    get_ticker_list,
    get_ticker_set,
    ticker_exists,
    get_company_name,
    add_ticker,
    update_ticker,
    remove_ticker,
    get_ticker_count,
    search_tickers,
)

__all__ = [
    "reload_cache",
    "get_ticker_map",
    "get_ticker_list",
    "get_ticker_set",
    "ticker_exists",
    "get_company_name",
    "add_ticker",
    "update_ticker",
    "remove_ticker",
    "get_ticker_count",
    "search_tickers",
]

