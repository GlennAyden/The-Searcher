"""
DEPRECATED: This module is deprecated. Import from shared.utils.broker_utils instead.

This file is kept for backward compatibility only.
All functionality has been moved to shared/utils/broker_utils.py.

Usage (new):
    from shared.utils.broker_utils import classify_broker, get_retail_brokers
    
Usage (legacy - still works):
    from modules.broker_utils import classify_broker, get_retail_brokers
"""
# Re-export everything from new location
from shared.utils.broker_utils import (
    BROKER_DATA_PATH,
    STAGE3_SMART_MONEY_OVERRIDES,
    STAGE3_RETAIL_OVERRIDES,
    get_all_brokers,
    get_broker_categories,
    get_broker_name,
    get_retail_brokers,
    get_institutional_brokers,
    get_foreign_brokers,
    get_mixed_brokers,
    get_stage3_smart_money_overrides,
    get_stage3_retail_overrides,
    classify_broker,
    is_retail,
    is_institutional,
    is_foreign,
    get_imposter_suspects,
)

__all__ = [
    "BROKER_DATA_PATH",
    "STAGE3_SMART_MONEY_OVERRIDES",
    "STAGE3_RETAIL_OVERRIDES",
    "get_all_brokers",
    "get_broker_categories",
    "get_broker_name",
    "get_retail_brokers",
    "get_institutional_brokers",
    "get_foreign_brokers",
    "get_mixed_brokers",
    "get_stage3_smart_money_overrides",
    "get_stage3_retail_overrides",
    "classify_broker",
    "is_retail",
    "is_institutional",
    "is_foreign",
    "get_imposter_suspects",
]
