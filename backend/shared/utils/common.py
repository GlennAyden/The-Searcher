"""
Common utility functions for news processing and text analysis.

Provides:
- Keyword blacklist/whitelist filtering
- Ticker extraction from text
- Text cleaning utilities
"""
import re
import json
import os

# Path to ticker data file
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_TICKER_DB_FILE = os.path.join(_BASE_DIR, "data", "idn_tickers.json")

# --- CONSTANTS ---
KEYWORDS_BLACKLIST = [
    "crypto", "bitcoin", "ethereum", "btc", "eth", "kripto", 
    "emas", "logam mulia", "profil", "sosok", "harta kekayaan", 
    "gaya hidup"
]

# "Soft" blacklist: Skip unless a ticker is explicitly mentioned
KEYWORDS_BLACKLIST_CONDITIONAL = ["anak usaha", "cucu usaha"]

KEYWORDS_WHITELIST = [
    "ihsg", "the fed", "bank indonesia", "bursa efek indonesia", 
    "ojk", "bei", "bi", "inflasi", "suku bunga"
]

# Words that look like tickers (4 uppercase) but are NOT issuers
NON_ISSUER_TICKERS = {
    "IHSG", "COMP", "LQ45", "JCI", "NEWS", "HTML", "PT", "TBK",
    "MSCI", "BPJS", "QRIS", "DPRD", "STNK", "KTP", "SIM", "BPKB", "ASN", "PNS"
}

# Global Cache for Ticker Map
TICKER_MAP = {}


def compile_keywords_regex(keywords):
    """Compiles a regex pattern for a list of keywords with word boundaries."""
    if not keywords:
        return None
    # Sort by length descending to match longer phrases first (optimization)
    sorted_kws = sorted(keywords, key=len, reverse=True)
    escaped = [re.escape(kw) for kw in sorted_kws]
    # \b matches word boundary. 
    # For phrases like "logam mulia", \blogam mulia\b matches.
    pattern = r'\b(?:' + '|'.join(escaped) + r')\b'
    return re.compile(pattern, re.IGNORECASE)


# Compile Regex Patterns once
REGEX_BLACKLIST = compile_keywords_regex(KEYWORDS_BLACKLIST)
REGEX_BLACKLIST_CONDITIONAL = compile_keywords_regex(KEYWORDS_BLACKLIST_CONDITIONAL)
REGEX_WHITELIST = compile_keywords_regex(KEYWORDS_WHITELIST)


def is_blacklisted(text, url=""):
    """
    Checks if text (Title) or URL contains blacklisted keywords.
    Returns: (bool, reason)
    """
    if not text:
        text = ""
    if not url:
        url = ""
        
    combined = (text + " " + url).lower()
    
    # 1. Hard Blacklist
    if REGEX_BLACKLIST:
        match = REGEX_BLACKLIST.search(combined)
        if match:
            return True, f"Blacklist match: {match.group()}"
            
    # 2. Conditional Blacklist (only if NO ticker in text)
    if REGEX_BLACKLIST_CONDITIONAL:
        match = REGEX_BLACKLIST_CONDITIONAL.search(combined)
        if match:
             # Check if title has tickers
             if extract_tickers(text): 
                 return False, "" # Has ticker, so it's relevant (e.g. "Anak Usaha BBRI...")
             return True, f"Conditional Blacklist match: {match.group()}"

    return False, ""


def has_whitelist_keywords(text):
    """
    Checks if text contains whitelist keywords (General Market News).
    """
    if not text or not REGEX_WHITELIST:
        return False
        
    return bool(REGEX_WHITELIST.search(text))


def load_ticker_map():
    """Loads ticker map from JSON if not already loaded."""
    global TICKER_MAP
    if not TICKER_MAP and os.path.exists(_TICKER_DB_FILE):
        try:
            with open(_TICKER_DB_FILE, 'r') as f:
                TICKER_MAP = json.load(f)
            print(f"[*] Loaded {len(TICKER_MAP)} tickers for name matching.")
        except Exception as e:
            print(f"[!] Error loading ticker DB: {e}")


def normalize_company_name(name):
    """
    Normalizes company name for fuzzy matching.
    Removes: PT, Tbk, (Persero), logical variations.
    """
    if not name:
        return ""
    
    # Lowercase
    clean = name.lower()
    
    # Remove common entities
    clean = clean.replace("pt ", "").replace("pt. ", "")
    clean = clean.replace(" tbk", "").replace(" (persero)", "")
    clean = clean.replace("perusahaan perseroan", "")
    
    # Remove excessive whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    
    return clean


def extract_tickers(text):
    """
    Extracts potential stock tickers from text (Title/Body).
    Strategies:
    1. Explicit Ticker: 4 Uppercase Letters (e.g. BBRI)
    2. Company Name Match: "Bank Rakyat Indonesia" -> BBRI
    
    Returns a list of unique tickers with .JK suffix.
    """
    if not text:
        return []
    
    # Ensure map is loaded
    load_ticker_map()
    
    unique_tickers = set()
    text_str = str(text)
    
    # 1. Explicit Regex Match
    matches = re.findall(r'\b[A-Z]{4}\b', text_str)
    for m in matches:
        if m not in NON_ISSUER_TICKERS: 
             unique_tickers.add(f"{m}.JK")
             
    # 2. Company Name Match (Scan)
    # This can be slow if text is huge, but fine for articles.
    # To optimize, we check normalized text presence.
    text_lower = text_str.lower()
    
    for code, company_name in TICKER_MAP.items():
        # Heuristic: Check normalized name length > 5 to avoid "PT X" false positives
        norm_name = normalize_company_name(company_name)
        if len(norm_name) < 4: 
            continue
            
        if norm_name in text_lower:
            unique_tickers.add(f"{code}.JK")
            # print(f"    [+] Name Match: '{company_name}' -> {code}.JK")

    return list(unique_tickers)


def clean_text_regex(text):
    """
    Cleans text using regex to remove common noise in scraped articles.
    """
    if not text:
        return ""
        
    text = re.sub(r'Baca juga:.*', '', text) 
    text = re.sub(r'Lihat juga:.*', '', text)
    text = re.sub(r'Author:.*', '', text)
    return text.strip()


def parse_indonesian_date(date_str):
    """
    Parses Indonesian date string if simpler methods fail.
    Example: "Senin, 12 Desember 2025"
    """
    # Requires locale mapping if standard datetime fails
    # This acts as a placeholder or wrapper for htmldate
    return date_str
