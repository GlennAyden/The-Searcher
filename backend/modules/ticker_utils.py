"""
Ticker Utility Module

This module provides a centralized interface for ticker management.
All ticker data is stored in idn_tickers.json (single source of truth).

Usage:
    from modules.ticker_utils import get_ticker_list, get_ticker_map, add_ticker, ticker_exists
"""

import json
import os
from typing import Dict, List, Optional

# Get the path to idn_tickers.json
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_TICKER_DB_FILE = os.path.join(_BASE_DIR, "data", "idn_tickers.json")

# Cache for ticker data
_ticker_cache: Optional[Dict[str, str]] = None


def _load_ticker_db() -> Dict[str, str]:
    """Load ticker database from file (with caching)."""
    global _ticker_cache
    if _ticker_cache is None:
        if os.path.exists(_TICKER_DB_FILE):
            with open(_TICKER_DB_FILE, 'r', encoding='utf-8') as f:
                _ticker_cache = json.load(f)
        else:
            _ticker_cache = {}
    return _ticker_cache


def _save_ticker_db(data: Dict[str, str]) -> None:
    """Save ticker database to file."""
    global _ticker_cache
    # Sort by keys before saving
    sorted_data = dict(sorted(data.items()))
    with open(_TICKER_DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted_data, f, indent=2, ensure_ascii=False)
    _ticker_cache = sorted_data


def reload_cache() -> None:
    """Force reload of ticker cache from file."""
    global _ticker_cache
    _ticker_cache = None
    _load_ticker_db()


def get_ticker_map() -> Dict[str, str]:
    """
    Get full ticker -> company name mapping.
    
    Returns:
        Dictionary mapping ticker codes to company names.
        
    Example:
        >>> get_ticker_map()
        {"AADI": "Pt Adaro Andalan Indonesia Tbk", "BBCA": "PT Bank Central Asia Tbk", ...}
    """
    return _load_ticker_db().copy()


def get_ticker_list() -> List[str]:
    """
    Get sorted list of all ticker codes.
    
    This replaces the need for tickers_idx.json.
    
    Returns:
        Sorted list of ticker codes.
        
    Example:
        >>> get_ticker_list()
        ["AADI", "AALI", "ABBA", ...]
    """
    return sorted(_load_ticker_db().keys())


def get_ticker_set() -> set:
    """
    Get set of all ticker codes for fast lookup.
    
    Returns:
        Set of ticker codes.
    """
    return set(_load_ticker_db().keys())


def ticker_exists(code: str) -> bool:
    """
    Check if a ticker exists in the database.
    
    Args:
        code: Ticker code (case-insensitive).
        
    Returns:
        True if ticker exists, False otherwise.
    """
    return code.upper() in _load_ticker_db()


def get_company_name(code: str) -> Optional[str]:
    """
    Get company name for a ticker code.
    
    Args:
        code: Ticker code (case-insensitive).
        
    Returns:
        Company name if found, None otherwise.
    """
    return _load_ticker_db().get(code.upper())


def add_ticker(code: str, company_name: str) -> bool:
    """
    Add a new ticker to the database.
    
    The database is automatically sorted after adding.
    
    Args:
        code: Ticker code (will be uppercased).
        company_name: Company name.
        
    Returns:
        True if added (new ticker), False if already exists.
        
    Example:
        >>> add_ticker("XYZZ", "PT XYZ Tbk")
        True
    """
    code = code.upper()
    data = _load_ticker_db()
    
    if code in data:
        return False
    
    data[code] = company_name
    _save_ticker_db(data)
    return True


def update_ticker(code: str, company_name: str) -> bool:
    """
    Update company name for an existing ticker.
    
    Args:
        code: Ticker code (case-insensitive).
        company_name: New company name.
        
    Returns:
        True if updated, False if ticker not found.
    """
    code = code.upper()
    data = _load_ticker_db()
    
    if code not in data:
        return False
    
    data[code] = company_name
    _save_ticker_db(data)
    return True


def remove_ticker(code: str) -> bool:
    """
    Remove a ticker from the database.
    
    Args:
        code: Ticker code (case-insensitive).
        
    Returns:
        True if removed, False if ticker not found.
    """
    code = code.upper()
    data = _load_ticker_db()
    
    if code not in data:
        return False
    
    del data[code]
    _save_ticker_db(data)
    return True


def get_ticker_count() -> int:
    """Get total number of tickers in database."""
    return len(_load_ticker_db())


def search_tickers(query: str) -> List[str]:
    """
    Search tickers by code or company name.
    
    Args:
        query: Search query (case-insensitive).
        
    Returns:
        List of matching ticker codes.
    """
    query_lower = query.lower()
    results = []
    
    for code, name in _load_ticker_db().items():
        if query_lower in code.lower() or query_lower in name.lower():
            results.append(code)
    
    return sorted(results)
