"""
DEPRECATED: This module is deprecated. Import from shared.utils.common instead.

This file is kept for backward compatibility only.
All functionality has been moved to shared/utils/common.py.

Usage (new):
    from shared.utils.common import extract_tickers, clean_text_regex
    
Usage (legacy - still works):
    from modules.utils import extract_tickers, clean_text_regex
"""
# Re-export everything from new location
from shared.utils.common import (
    KEYWORDS_BLACKLIST,
    KEYWORDS_BLACKLIST_CONDITIONAL,
    KEYWORDS_WHITELIST,
    NON_ISSUER_TICKERS,
    TICKER_MAP,
    compile_keywords_regex,
    REGEX_BLACKLIST,
    REGEX_BLACKLIST_CONDITIONAL,
    REGEX_WHITELIST,
    is_blacklisted,
    has_whitelist_keywords,
    load_ticker_map,
    normalize_company_name,
    extract_tickers,
    clean_text_regex,
    parse_indonesian_date,
)

__all__ = [
    "KEYWORDS_BLACKLIST",
    "KEYWORDS_BLACKLIST_CONDITIONAL", 
    "KEYWORDS_WHITELIST",
    "NON_ISSUER_TICKERS",
    "TICKER_MAP",
    "compile_keywords_regex",
    "REGEX_BLACKLIST",
    "REGEX_BLACKLIST_CONDITIONAL",
    "REGEX_WHITELIST",
    "is_blacklisted",
    "has_whitelist_keywords",
    "load_ticker_map",
    "normalize_company_name",
    "extract_tickers",
    "clean_text_regex",
    "parse_indonesian_date",
]

