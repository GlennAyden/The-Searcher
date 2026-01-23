"""
Centralized Broker Classification Utility.
Loads broker data from brokers_idx.json and provides classification methods.
"""
import json
import os
from typing import Dict, List, Set, Optional
from functools import lru_cache


# Path to broker data file
BROKER_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'brokers_idx.json')


@lru_cache(maxsize=1)
def _load_broker_data() -> Dict:
    """Load broker data from JSON file (cached)."""
    try:
        with open(BROKER_DATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[!] Error loading broker data: {e}")
        return {"brokers": [], "categories": {}}


def get_all_brokers() -> List[Dict]:
    """Get list of all brokers with their info."""
    data = _load_broker_data()
    return data.get("brokers", [])


def get_broker_categories(broker_code: str) -> List[str]:
    """Get categories for a specific broker code."""
    data = _load_broker_data()
    for broker in data.get("brokers", []):
        if broker.get("code") == broker_code.upper():
            return broker.get("category", ["unknown"])
    return ["unknown"]


def get_broker_name(broker_code: str) -> str:
    """Get broker name from code."""
    data = _load_broker_data()
    for broker in data.get("brokers", []):
        if broker.get("code") == broker_code.upper():
            return broker.get("name", broker_code)
    return broker_code


@lru_cache(maxsize=1)
def get_retail_brokers() -> Set[str]:
    """Get set of retail broker codes."""
    data = _load_broker_data()
    retail = set()
    for broker in data.get("brokers", []):
        categories = broker.get("category", [])
        if "retail" in categories and "institutional" not in categories and "foreign" not in categories:
            retail.add(broker.get("code"))
    return retail


@lru_cache(maxsize=1)
def get_institutional_brokers() -> Set[str]:
    """Get set of institutional broker codes (excluding foreign)."""
    data = _load_broker_data()
    institutional = set()
    for broker in data.get("brokers", []):
        categories = broker.get("category", [])
        if "institutional" in categories and "foreign" not in categories:
            institutional.add(broker.get("code"))
    return institutional


@lru_cache(maxsize=1)
def get_foreign_brokers() -> Set[str]:
    """Get set of foreign broker codes."""
    data = _load_broker_data()
    foreign = set()
    for broker in data.get("brokers", []):
        categories = broker.get("category", [])
        if "foreign" in categories:
            foreign.add(broker.get("code"))
    return foreign


@lru_cache(maxsize=1)
def get_mixed_brokers() -> Set[str]:
    """Get set of mixed broker codes (both retail and institutional)."""
    data = _load_broker_data()
    mixed = set()
    for broker in data.get("brokers", []):
        categories = broker.get("category", [])
        if "retail" in categories and "institutional" in categories:
            mixed.add(broker.get("code"))
    return mixed


def classify_broker(broker_code: str) -> str:
    """
    Classify a broker into primary category.
    Priority: foreign > institutional > retail > unknown
    """
    if broker_code in get_foreign_brokers():
        return "foreign"
    elif broker_code in get_institutional_brokers():
        return "institutional"
    elif broker_code in get_retail_brokers():
        return "retail"
    elif broker_code in get_mixed_brokers():
        return "mixed"
    return "unknown"


def is_retail(broker_code: str) -> bool:
    """Check if broker is primarily retail."""
    categories = get_broker_categories(broker_code)
    return "retail" in categories and "institutional" not in categories and "foreign" not in categories


def is_institutional(broker_code: str) -> bool:
    """Check if broker is institutional (includes foreign)."""
    categories = get_broker_categories(broker_code)
    return "institutional" in categories or "foreign" in categories


def is_foreign(broker_code: str) -> bool:
    """Check if broker is foreign."""
    return "foreign" in get_broker_categories(broker_code)


# Alias for common patterns (imposter detection: retail acting as institutional)
def get_imposter_suspects() -> Set[str]:
    """
    Get brokers that could potentially be imposters (retail + mixed).
    These are brokers commonly used for smart money to hide positions.
    """
    suspects = get_retail_brokers().copy()
    suspects.update(get_mixed_brokers())
    return suspects
