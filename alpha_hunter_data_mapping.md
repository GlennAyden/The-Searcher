# Alpha Hunter Stages: Data Source Mapping & Integration Report

## Executive Summary

Laporan ini menganalisa bagaimana data dari **Market Summary (NeoBDM)** dan **Flow Tracker (Running Trade)** akan digunakan di **Alpha Hunter Stage 1-4**.

---

## 📊 Data Sources Overview

### 1. Market Summary (NeoBDM)

**Source**: NeoBDM scraper (`neobdm_records` table)

**Data Fields Available**:
```python
{
    "symbol": "BBCA",
    "method": "m" | "nr" | "f",  # m=Market Maker, nr=Non-Retail, f=Foreign
    "period": "d" | "c",          # d=Daily, c=Cumulative
    
    # Flow Data
    "d_0": "12.5M",     # Today's flow
    "d_2": "8.3M",      # D-2 flow
    "d_3": "15.7M",     # D-3 flow
    "d_4": "-5.2M",     # D-4 flow
    
    # Weekly Flow
    "w_1": "45.2M",     # Week 1 flow
    "w_2": "32.1M",     # Week 2 flow
    "w_3": "28.9M",     # Week 3 flow
    "w_4": "15.3M",     # Week 4 flow
    
    # Cumulative Flow
    "c_3": "85.5M",     # Cumulative 3 days
    "c_5": "142.3M",    # Cumulative 5 days
    "c_10": "258.7M",   # Cumulative 10 days
    "c_20": "512.4M",   # Cumulative 20 days
    
    # Price Changes
    "pct_1d": "2.5%",   # 1-day price change
    "pct_3d": "7.2%",   # 3-day price change
    "pct_5d": "12.3%",  # 5-day price change
    "pct_10d": "18.5%", # 10-day price change
    "pct_20d": "25.7%", # 20-day price change
    
    # Price & MA
    "price": "8500",
    "ma5": "8350",
    "ma10": "8200",
    "ma20": "8000",
    "ma50": "7800",
    "ma100": "7500",
    
    # Flags
    "pinky": "🩷" | "",     # Pinky flag (strong buy signal)
    "crossing": "🤏" | "",  # MA crossing signal
    "likuid": "💧" | "",    # High liquidity
    "unusual": "🔥" | ""    # Unusual activity
}
```

**Table Schema**:
```sql
neobdm_records (
    id, scraped_at, method, period, symbol,
    pinky, crossing, likuid,
    w_4, w_3, w_2, w_1,
    d_4, d_3, d_2, d_0,
    pct_1d, c_20, c_10, c_5, c_3,
    pct_3d, pct_5d, pct_10d, pct_20d,
    price, ma5, ma10, ma20, ma50, ma100,
    unusual
)
```

---

### 2. Flow Tracker (Running Trade)

**Source**: Running Trade scraper (`rt_snapshots`, `rt_raw_history` tables)

**Data Fields Available**:

**A. RT Snapshots (15-minute intervals)**:
```python
{
    "ticker": "BBCA",
    "interval_start": "2026-01-22 09:00:00",
    "interval_end": "2026-01-22 09:15:00",
    "buy_vol": 1250000,      # Buy volume in lots
    "sell_vol": 890000,      # Sell volume in lots
    "net_vol": 360000,       # Net volume
    "avg_price": 8450.0,
    "status": "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL",
    "big_order_count": 15,   # Number of big orders (≥100 lots)
    "conclusion": "Strong buying pressure"
}
```

**B. RT Raw History (Every trade)**:
```python
{
    "id": "BBCA_2026-01-22_09:05:23_001",
    "ticker": "BBCA",
    "time": "09:05:23",
    "action": "B" | "S",     # Buy or Sell
    "price": 8450.0,
    "lot": 150,              # Trade size
    "buyer": "NH",           # Buyer broker code
    "seller": "CS",          # Seller broker code
    "trade_number": "12345",
    "market_board": "RG",    # Regular market
    "scrape_date": "2026-01-22"
}
```

**Table Schemas**:
```sql
rt_snapshots (
    id, ticker, interval_start, interval_end,
    buy_vol, sell_vol, net_vol, avg_price,
    status, big_order_count, conclusion
)

rt_raw_history (
    id, ticker, time, action, price, lot,
    buyer, seller, trade_number, market_board, scrape_date
)
```

---

## 🎯 Alpha Hunter Stages: Data Mapping

### Stage 1: Volume Anomaly Scanner (Filter Awal)

**Purpose**: Deteksi saham dengan volume spike dan sideways compression

**Data Sources Used**:

| Data Source | Fields Used | Purpose |
|-------------|-------------|---------|
| **Price Volume** | `volume`, `close`, `high`, `low` | Volume spike detection, sideways compression |
| **Market Cap** | `market_cap`, `shares_outstanding` | Flow impact calculation |
| NeoBDM (optional) | `unusual` flag | Cross-validation |

**Current Implementation**: ✅ **FULLY IMPLEMENTED** via Price & Volume engine

**NeoBDM Integration Points**:
```python
# Optional: Use NeoBDM unusual flag as additional filter
def enhance_stage1_with_neobdm(ticker, date):
    # Get Stage 1 score from Price & Volume
    pv_score = calculate_anomaly_score(ticker, date, volume_ratio)
    
    # Get NeoBDM signals
    neobdm_data = get_neobdm_record(ticker, date)
    
    # Bonus points if NeoBDM flags match
    if neobdm_data.get('unusual') == '🔥':
        pv_score['total_score'] += 5  # Bonus for NeoBDM confirmation
    
    return pv_score
```

**Verdict**: Stage 1 tidak bergantung pada Market Summary, tapi bisa di-enhance dengan NeoBDM flags.

---

### Stage 2: Fund Flow Analysis (Analisis Aliran Dana)

**Purpose**: Analisa pola aliran dana dari berbagai sumber (MM, Non-Retail, Foreign)

**Data Sources Used**:

| Data Source | Fields Used | Purpose |
|-------------|-------------|---------|
| **NeoBDM Market Summary** | `d_0`, `d_2`, `d_3`, `d_4` | Daily flow pattern |
| **NeoBDM Market Summary** | `w_1`, `w_2`, `w_3`, `w_4` | Weekly flow trend |
| **NeoBDM Market Summary** | `c_3`, `c_5`, `c_10`, `c_20` | Cumulative flow strength |
| **NeoBDM Market Summary** | `method` (m/nr/f) | Multi-method confluence |
| **NeoBDM Flags** | `pinky`, `crossing`, `likuid` | Signal confirmation |

**Score Calculation Example**:
```python
def calculate_stage2_score(ticker, date):
    # Get all 3 methods for the ticker
    mm_flow = get_neobdm_record(ticker, date, method='m')      # Market Maker
    nr_flow = get_neobdm_record(ticker, date, method='nr')     # Non-Retail
    foreign_flow = get_neobdm_record(ticker, date, method='f') # Foreign
    
    score = 0
    
    # 1. Flow Consistency (40 points)
    # Check if flows are positive across multiple days
    if all([
        parse_flow(mm_flow['d_0']) > 0,
        parse_flow(mm_flow['d_2']) > 0,
        parse_flow(mm_flow['d_3']) > 0
    ]):
        score += 40
    elif count_positive_flows([mm_flow['d_0'], mm_flow['d_2'], mm_flow['d_3']]) >= 2:
        score += 25
    
    # 2. Multi-Method Confluence (30 points)
    positive_methods = []
    if parse_flow(mm_flow['d_0']) > 0:
        positive_methods.append('MM')
    if parse_flow(nr_flow['d_0']) > 0:
        positive_methods.append('Non-Retail')
    if parse_flow(foreign_flow['d_0']) > 0:
        positive_methods.append('Foreign')
    
    if len(positive_methods) >= 3:
        score += 30  # Triple confluence
    elif len(positive_methods) == 2:
        score += 20
    
    # 3. Cumulative Strength (30 points)
    # Compare c_3, c_5, c_10 growth
    c3 = parse_flow(mm_flow['c_3'])
    c5 = parse_flow(mm_flow['c_5'])
    c10 = parse_flow(mm_flow['c_10'])
    
    if c3 > 0 and c5 > c3 * 1.5 and c10 > c5 * 1.5:
        score += 30  # Accelerating accumulation
    elif c3 > 0 and c5 > c3:
        score += 20
    
    return {
        'total_score': score,
        'confidence': 'HIGH' if score >= 70 else 'MEDIUM' if score >= 50 else 'LOW',
        'positive_methods': positive_methods,
        'flow_pattern': analyze_pattern(mm_flow)
    }
```

**Key Metrics**:
- **Flow Consistency**: Daily flows (d_0, d_2, d_3, d_4) - semua positif = strong signal
- **Multi-Method Confluence**: MM + NonRetail + Foreign = triple threat
- **Cumulative Growth**: c_3 < c_5 < c_10 = accelerating accumulation

**Verdict**: Stage 2 **HEAVILY RELIES** on Market Summary NeoBDM data.

---

### Stage 3: Smart Money Detection (Deteksi Bandar/Fund)

**Purpose**: Identifikasi aktivitas smart money melalui broker pattern dan order flow

**Data Sources Used**:

| Data Source | Fields Used | Purpose |
|-------------|-------------|---------|
| **RT Raw History** | `buyer`, `seller`, `lot`, `price` | Broker activity pattern |
| **RT Snapshots** | `buy_vol`, `sell_vol`, `big_order_count` | Order flow analysis |
| **NeoBDM Broker Summary** | `broker`, `nlot`, `nval`, `side` | Top broker accumulation |
| **Broker 5%** | `broker_code`, `ticker` | Tracked broker watchlist |

**Analysis Techniques**:
```python
def calculate_stage3_score(ticker, date):
    score = 0
    
    # 1. Big Order Analysis (30 points)
    # From RT Snapshots
    snapshots = get_rt_snapshots(ticker, date)
    big_order_ratio = sum(s['big_order_count'] for s in snapshots) / len(snapshots)
    
    if big_order_ratio > 10:  # Average >10 big orders per 15min
        score += 30
    elif big_order_ratio > 5:
        score += 20
    
    # 2. Broker Concentration (40 points)
    # From NeoBDM Broker Summary
    broker_summary = get_broker_summary(ticker, date)
    top_buyers = broker_summary.filter(side='BUY').sort_by('nval').head(5)
    
    # Check if top 5 brokers account for >50% of buy value
    total_buy_value = broker_summary.filter(side='BUY').sum('nval')
    top5_value = sum(b['nval'] for b in top_buyers)
    concentration = top5_value / total_buy_value
    
    if concentration > 0.6:  # >60% concentration
        score += 40
    elif concentration > 0.5:
        score += 30
    
    # 3. Tracked Broker Match (30 points)
    # Check if any top buyers are in broker_five_percent watchlist
    tracked_brokers = get_tracked_brokers(ticker)
    matched_brokers = [b for b in top_buyers if b['broker'] in tracked_brokers]
    
    if len(matched_brokers) >= 2:
        score += 30
    elif len(matched_brokers) == 1:
        score += 20
    
    return {
        'total_score': score,
        'top_brokers': [b['broker'] for b in top_buyers],
        'matched_trackers': matched_brokers,
        'concentration_pct': round(concentration * 100, 1)
    }
```

**Key Analysis**:
- **Big Order Count**: Dari RT Snapshots `big_order_count` field
- **Broker Concentration**: Top 5 brokers dominate buying?
- **Tracked Broker Match**: Apakah broker yang kita track sedang aktif?

**Verdict**: Stage 3 **DEPENDS ON** both Running Trade data and NeoBDM Broker Summary.

---

### Stage 4: Entry Timing Confirmation (Timing Masuk)

**Purpose**: Konfirmasi timing entry berdasarkan real-time order flow dan price action

**Data Sources Used**:

| Data Source | Fields Used | Purpose |
|-------------|-------------|---------|
| **RT Raw History** | `time`, `action`, `price`, `lot` | Real-time order flow |
| **RT Snapshots** | `status`, `net_vol`, `avg_price` | Trend confirmation |
| **NeoBDM** | `pct_1d`, `pct_3d`, `price vs MA` | Price momentum |
| **Price Volume** | Current price, volume | Entry price validation |

**Timing Signals**:
```python
def calculate_stage4_timing(ticker):
    score = 0
    
    # 1. Recent Momentum (25 points)
    neobdm = get_latest_neobdm(ticker)
    pct_1d = parse_pct(neobdm['pct_1d'])
    pct_3d = parse_pct(neobdm['pct_3d'])
    
    # Positive but not overbought (+1% to +5%)
    if 1.0 < pct_1d < 5.0 and 3.0 < pct_3d < 10.0:
        score += 25
    elif pct_1d > 0 and pct_3d > 0:
        score += 15
    
    # 2. Current Order Flow (35 points)
    # Last 3 intervals from RT Snapshots
    recent_snapshots = get_rt_snapshots(ticker, limit=3)
    
    # All showing accumulation?
    if all(s['status'] == 'ACCUMULATION' for s in recent_snapshots):
        score += 35
    elif sum(1 for s in recent_snapshots if s['status'] == 'ACCUMULATION') >= 2:
        score += 25
    
    # 3. Price vs MA Position (20 points)
    price = float(neobdm['price'])
    ma5 = float(neobdm['ma5'])
    ma10 = float(neobdm['ma10'])
    ma20 = float(neobdm['ma20'])
    
    # Golden setup: Price > MA5 > MA10 > MA20
    if price > ma5 > ma10 > ma20:
        score += 20
    elif price > ma5 and ma5 > ma10:
        score += 15
    
    # 4. Big Order Recency (20 points)
    # Check for big orders in last 30 minutes
    recent_trades = get_rt_raw_history(ticker, minutes=30)
    big_trades = [t for t in recent_trades if t['lot'] >= 100]
    big_buy_ratio = len([t for t in big_trades if t['action'] == 'B']) / max(len(big_trades), 1)
    
    if big_buy_ratio > 0.7:  # >70% of big orders are buys
        score += 20
    elif big_buy_ratio > 0.5:
        score += 10
    
    return {
        'total_score': score,
        'entry_signal': 'STRONG' if score >= 70 else 'MODERATE' if score >= 50 else 'WEAK',
        'current_status': recent_snapshots[0]['status'] if recent_snapshots else 'UNKNOWN',
        'price_setup': 'GOLDEN' if price > ma5 > ma10 > ma20 else 'PARTIAL'
    }
```

**Key Confirmations**:
- **Order Flow**: Recent 15-min intervals harus ACCUMULATION
- **Momentum**: Positive tapi belum overbought
- **MA Setup**: Golden cross pattern (Price > MA5 > MA10 > MA20)
- **Big Orders**: Recent big buys confirm smart money entry

**Verdict**: Stage 4 **COMBINES** all data sources - NeoBDM for momentum, RT for real-time flow.

---

## 📋 Data Source Summary by Stage

| Stage | NeoBDM Market Summary | Running Trade | Price Volume | Market Cap |
|-------|----------------------|---------------|--------------|------------|
| **Stage 1** | ⚠️ Optional (bonus) | ❌ Not used | ✅ **Primary** | ✅ **Primary** |
| **Stage 2** | ✅ **Primary** | ❌ Not used | ⚠️ Supporting | ⚠️ Supporting |
| **Stage 3** | ✅ **Heavy use** | ✅ **Primary** | ⚠️ Supporting | ❌ Not used |
| **Stage 4** | ✅ **Heavy use** | ✅ **Primary** | ✅ Supporting | ❌ Not used |

---

## 🔧 Implementation Status

### Stage 1: Volume Anomaly Scanner
- ✅ Backend: DONE (Price & Volume engine)
- ✅ API: DONE (`/api/price-volume/anomaly/scan`)
- ⚠️ Frontend: Partial (needs score display)
- ⚠️ NeoBDM Integration: NOT DONE (optional enhancement)

### Stage 2: Fund Flow Analysis
- ❌ Backend: NOT IMPLEMENTED
- ❌ API: NOT IMPLEMENTED
- ❌ Frontend: NOT IMPLEMENTED
- ✅ Data Available: YES (neobdm_records table)

**Required Implementation**:
```python
# New file: backend/db/alpha_hunter_stage2.py
class Stage2FlowAnalyzer:
    def analyze_fund_flow(self, ticker, date):
        # Get all 3 methods
        # Calculate flow consistency
        # Check multi-method confluence
        # Analyze cumulative patterns
        # Return score 0-100
        
# New endpoint: /api/alpha-hunter/stage2/analyze/{ticker}
```

### Stage 3: Smart Money Detection
- ❌ Backend: NOT IMPLEMENTED
- ❌ API: NOT IMPLEMENTED
- ❌ Frontend: NOT IMPLEMENTED
- ⚠️ Data: Partial (RT data exists, broker summary needs work)

**Required Implementation**:
```python
# New file: backend/db/alpha_hunter_stage3.py
class Stage3SmartMoneyDetector:
    def detect_smart_money(self, ticker, date):
        # Analyze RT big orders
        # Calculate broker concentration
        # Match with tracked brokers
        # Return score 0-100
        
# New endpoint: /api/alpha-hunter/stage3/detect/{ticker}
```

### Stage 4: Entry Timing
- ❌ Backend: NOT IMPLEMENTED
- ❌ API: NOT IMPLEMENTED
- ❌ Frontend: NOT IMPLEMENTED
- ✅ Data Available: YES (all sources ready)

**Required Implementation**:
```python
# New file: backend/db/alpha_hunter_stage4.py
class Stage4TimingAnalyzer:
    def analyze_entry_timing(self, ticker):
        # Check recent order flow
        # Validate momentum
        # Confirm MA setup
        # Return entry signal
        
# New endpoint: /api/alpha-hunter/stage4/timing/{ticker}
```

---

## 🎯 Recommendations

### Priority 1: Complete Stage 2 (Fund Flow Analysis)
**Why**: Core differentiator, uses unique NeoBDM data
**Effort**: Medium (2-3 days)
**Impact**: HIGH

**Checklist**:
- [ ] Create `alpha_hunter_stage2.py` repository
- [ ] Implement multi-method confluence logic
- [ ] Implement cumulative flow analysis
- [ ] Create API endpoint `/api/alpha-hunter/stage2/analyze`
- [ ] Build Stage 2 frontend page

### Priority 2: Complete Stage 3 (Smart Money Detection)
**Why**: Powerful for institutional tracking
**Effort**: High (3-4 days)
**Impact**: HIGH

**Checklist**:
- [ ] Enhance broker summary data quality
- [ ] Implement big order analysis from RT
- [ ] Implement broker concentration metrics
- [ ] Create tracked broker matching logic
- [ ] Create API endpoint `/api/alpha-hunter/stage3/detect`
- [ ] Build Stage 3 frontend page

### Priority 3: Complete Stage 4 (Entry Timing)
**Why**: Completes the full pipeline
**Effort**: Medium (2-3 days)
**Impact**: MEDIUM

**Checklist**:
- [ ] Implement real-time order flow monitor
- [ ] Implement momentum validation
- [ ] Implement MA setup checker
- [ ] Create API endpoint `/api/alpha-hunter/stage4/timing`
- [ ] Build Stage 4 frontend page

### Priority 4: Integrate All Stages
**Why**: Seamless workflow
**Effort**: Medium (2 days)
**Impact**: HIGH

**Checklist**:
- [ ] Create unified Alpha Hunter dashboard
- [ ] Implement stage progression flow
- [ ] Add watchlist management
- [ ] Build final recommendation engine

---

## 📊 Data Dependency Graph

```
┌─────────────────┐
│  Price Volume   │─────────► Stage 1: Scanner
│   + Market Cap  │
└─────────────────┘

┌─────────────────┐
│ NeoBDM Market   │─────────► Stage 2: Fund Flow
│    Summary      │           (m/nr/f methods)
└─────────────────┘

┌─────────────────┐
│ NeoBDM Broker   │─┐
│    Summary      │ │
└─────────────────┘ │
                    ├────────► Stage 3: Smart Money
┌─────────────────┐ │
│  Running Trade  │─┘
│   (RT Data)     │
└─────────────────┘

┌─────────────────┐
│   ALL ABOVE     │─────────► Stage 4: Entry Timing
│   COMBINED      │
└─────────────────┘
```

---

## Conclusion

### What's Ready:
- ✅ **Stage 1**: Fully implemented via Price & Volume engine
- ✅ **Data Infrastructure**: All required tables exist
- ✅ **Data Availability**: NeoBDM and RT data being scraped

### What's Missing:
- ❌ **Stage 2-4 Logic**: Not implemented
- ❌ **API Endpoints**: Stage 2-4 endpoints don't exist
- ❌ **Frontend**: Stage 2-4 UI not built

### Estimated Total Effort:
- **Stage 2**: 2-3 days
- **Stage 3**: 3-4 days
- **Stage 4**: 2-3 days
- **Integration**: 2 days
- **Total**: ~9-12 days for complete Alpha Hunter system

**Next Step**: Implement Stage 2 Fund Flow Analyzer as it's the core differentiator.
