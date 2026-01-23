# Alpha Hunter Stage 1 - REDESIGN: Flow-Based Screening

## Executive Summary

**NEW APPROACH**: Stage 1 Alpha Hunter akan menggunakan **Market Summary Flow** dan **Flow Tracker Real-time Data** sebagai primary screening mechanism, menggantikan approach volume-based.

---

## 🎯 Strategic Shift

### OLD Approach (Volume-Based):
```
Stage 1: Volume Spike → Compression → Flow Impact
         ↓
    Filter by composite score
```
**Problem**: 
- Volume spike bisa terlambat (sudah naik)
- Tidak capture smart money accumulation yang stealthy
- Miss early entry opportunities

### NEW Approach (Flow-Based):
```
Stage 1: NeoBDM Hot Signals (Flow Analysis)
         ↓
    Multi-factor flow scoring + Pattern recognition
         ↓
    Filter HIGH CONVICTION signals BEFORE breakout
```
**Benefits**:
- ✅ Deteksi akumulasi SEBELUM pump
- ✅ Multi-timeframe confirmation (D+W+C)
- ✅ Pattern recognition (6 key patterns)
- ✅ Smart vs Dumb money distinction

---

## 📊 NeoBDM Hot Signal Scoring Engine

### Existing Implementation Analysis

**Current scoring components** (from `neobdm_repository.py`):

| Component | Weight | Description |
|-----------|--------|-------------|
| **Flow Magnitude** | 0-50 pts | d_0 flow strength (0-200M+) |
| **Price Momentum** | -30 to +15 pts | Sweet spot: -1% to +3% |
| **Flow-Price Synergy** | -20 to +30 pts | Big flow + low price = IDEAL |
| **Timeframe Alignment** | 0-60 pts | D+W+C alignment |
| **Momentum Analysis** | 0-40 pts | Velocity + Acceleration |
| **Early Warning** | -60 to 0 pts | Risk flags (overbought, etc) |
| **Pattern Recognition** | -40 to +40 pts | 6 key patterns |
| **Multi-Method Confluence** | 0-50 pts | MM + NonRetail + Foreign agreement |
| **Relative Flow Score** | 0-30 pts | Size-adjusted flow strength |

**Total Score Range**: -200 to +350 points

**Signal Strength Classification**:
```python
score >= 150  → VERY_STRONG
score >= 90   → STRONG
score >= 45   → MODERATE
score >= 0    → WEAK
score < 0     → AVOID
```

---

## 🔥 Key Pattern Recognition

### Pattern 1: Consistent Accumulation (+40 pts) ✅ BEST
```python
if all([d_0 > 0, d_2 > 0, d_3 > 0, d_4 > 0]) and c_20 > c_10 > c_3:
    # All daily flows positive + cumulative growing
    # = Smart money quietly accumulating
```

**Characteristics**:
- Daily flows: ALL positive for 4+ days
- Cumulative: Accelerating (c_20 > c_10 > c_3)
- Price: Belum naik signifikan (<3%)

**Trading Signal**: STRONG BUY - Early accumulation phase

---

### Pattern 2: Accelerating Build-up (+30 pts) 🚀 VERY STRONG
```python
if d_0 > d_2 > d_3 > d_4 and d_0 > 50:
    # Each day bigger than previous
    # = Accumulation intensity increasing
```

**Characteristics**:
- Flow growing day-by-day (d_0 > d_2 > d_3 > d_4)
- Today's flow significant (>50M)
- Momentum building

**Trading Signal**: STRONG BUY - About to explode

---

### Pattern 3: Trend Reversal (+25 pts) 🔄 OPPORTUNITY
```python
if w_2 < 0 and w_1 > 0 and d_0 > 100:
    # Previous week outflow, current week inflow
    # = Smart money entering after shakeout
```

**Characteristics**:
- Week 2: Outflow (distribution)
- Week 1: Strong inflow
- Today: Heavy buying (>100M)

**Trading Signal**: BUY - Reversal confirmed

---

### Pattern 4: Sideways Accumulation (+20 pts) 📊 GOOD
```python
if c_20 > 300 and -20 < velocity < 20:
    # Large cumulative flow, but price sideways
    # = Stealth accumulation (best setup)
```

**Characteristics**:
- Cumulative flow: Large (>300M over 20 days)
- Velocity: Low (-20 to +20)
- Price: Flat/sideways

**Trading Signal**: BUY - Compression before expansion

---

### Pattern 5: Sudden Spike (-15 pts) ⚡ RISKY
```python
if d_0 > 150 and c_10 < 200:
    # Today huge, but recent history weak
    # = Retail FOMO or pump & dump
```

**Characteristics**:
- Today's flow: Massive (>150M)
- 10-day cumulative: Low (<200M)
- Price: Usually already up >5%

**Trading Signal**: AVOID - Late entry trap

---

### Pattern 6: Distribution (-40 pts) ❌ AVOID
```python
if all([d_0 < 0, d_2 < 0, d_3 < 0]):
    # All recent days negative
    # = Smart money exiting
```

**Characteristics**:
- Daily flows: ALL negative
- Price: May still be high
- Volume: Selling pressure

**Trading Signal**: AVOID/SELL - Distribution phase

---

## 🎯 Alpha Hunter Stage 1 - New Design

### Screening Criteria

**Filter 1: Signal Strength**
```python
# Only include signals with score >= 45 (MODERATE or better)
hot_signals = get_neobdm_hot()
filtered = [s for s in hot_signals if s['signal_score'] >= 45]
```

**Filter 2: Pattern Quality**
```python
# Must have at least ONE positive pattern
positive_patterns = [
    'CONSISTENT_ACCUMULATION',
    'ACCELERATING_BUILDUP',
    'TREND_REVERSAL',
    'SIDEWAYS_ACCUMULATION'
]

qualified = [s for s in filtered if any(
    p['name'] in positive_patterns 
    for p in s['patterns']
)]
```

**Filter 3: Price Sweet Spot**
```python
# Price change: -3% to +3% (belum late entry)
sweet_spot = [s for s in qualified if -3 <= s['change'] <= 3]
```

**Filter 4: Flow Magnitude**
```python
# Min flow: 20M (significant for retail attention)
meaningful_flow = [s for s in sweet_spot if s['flow'] >= 20]
```

---

## 🔧 Implementation

### Backend: Enhance NeoBDM Hot Signals

**New Endpoint**: `GET /api/alpha-hunter/stage1/scan`

```python
# File: backend/routes/alpha_hunter.py

@router.get("/alpha-hunter/stage1/scan")
async def alpha_hunter_stage1_scan(
    min_score: int = Query(45, description="Minimum signal score"),
    min_flow: float = Query(20.0, description="Minimum flow in millions"),
    max_price_change: float = Query(3.0, description="Max price change %"),
    required_patterns: List[str] = Query(
        default=["CONSISTENT_ACCUMULATION", "ACCELERATING_BUILDUP"],
        description="At least one pattern must match"
    )
):
    """
    Alpha Hunter Stage 1: Flow-Based Screening
    
    Returns high-conviction signals based on NeoBDM flow analysis.
    Filters for early-stage accumulation patterns before breakout.
    """
    from modules.database import DatabaseManager
    
    db = DatabaseManager()
    hot_signals = db.get_latest_hot_signals()
    
    # Apply filters
    filtered_signals = []
    
    for signal in hot_signals:
        # Filter 1: Score threshold
        if signal['signal_score'] < min_score:
            continue
        
        # Filter 2: Flow magnitude
        if signal['flow'] < min_flow:
            continue
        
        # Filter 3: Price sweet spot
        if abs(signal['change']) > max_price_change:
            continue
        
        # Filter 4: Pattern matching
        signal_patterns = [p['name'] for p in signal.get('patterns', [])]
        if not any(p in signal_patterns for p in required_patterns):
            continue
        
        # Passed all filters
        filtered_signals.append(signal)
    
    # Sort by signal score descending
    filtered_signals.sort(key=lambda x: x['signal_score'], reverse=True)
    
    return {
        "total_signals": len(hot_signals),
        "filtered_count": len(filtered_signals),
        "signals": filtered_signals,
        "filters_applied": {
            "min_score": min_score,
            "min_flow": min_flow,
            "max_price_change": max_price_change,
            "required_patterns": required_patterns
        }
    }
```

---

### Enhanced Scoring with Flow Tracker Integration

**New Feature**: Real-time Order Flow Confirmation

```python
# File: backend/db/alpha_hunter_repository.py

def enhance_signal_with_flow_tracker(signal: Dict) -> Dict:
    """
    Enhance NeoBDM signal with real-time Flow Tracker data.
    
    Adds:
    - Current day buy/sell pressure
    - Last 30-min order flow status
    - Big order count (smart money activity)
    """
    from db.running_trade_repository import RunningTradeRepository
    
    rt_repo = RunningTradeRepository()
    ticker = signal['symbol']
    
    # Get today's RT snapshots
    today = datetime.now().strftime('%Y-%m-%d')
    snapshots = rt_repo.get_snapshots_by_date(ticker, today)
    
    if not snapshots:
        signal['rt_status'] = 'NO_DATA'
        return signal
    
    # Analyze recent snapshots (last 3 intervals = 45 min)
    recent = snapshots[-3:] if len(snapshots) >= 3 else snapshots
    
    # Calculate metrics
    total_buy = sum(s['buy_vol'] for s in recent)
    total_sell = sum(s['sell_vol'] for s in recent)
    net_vol = total_buy - total_sell
    big_orders = sum(s.get('big_order_count', 0) for s in recent)
    
    # Determine RT status
    if net_vol > 0 and big_orders >= 5:
        rt_status = 'STRONG_BUYING'
        bonus_score = 15
    elif net_vol > 0:
        rt_status = 'ACCUMULATION'
        bonus_score = 10
    elif abs(net_vol) < total_buy * 0.1:
        rt_status = 'NEUTRAL'
        bonus_score = 0
    else:
        rt_status = 'DISTRIBUTION'
        bonus_score = -15
    
    # Enhance signal
    signal['rt_status'] = rt_status
    signal['rt_net_vol'] = net_vol
    signal['rt_big_orders'] = big_orders
    signal['rt_bonus_score'] = bonus_score
    signal['signal_score'] += bonus_score  # Add RT bonus to total
    
    return signal
```

---

## 📊 Comparison: Old vs New Stage 1

| Aspect | OLD (Volume-Based) | NEW (Flow-Based) |
|--------|-------------------|------------------|
| **Primary Signal** | Volume spike | Flow pattern |
| **Detection Timing** | Often late (after spike) | Early (during accumulation) |
| **Data Source** | Price/Volume only | NeoBDM + Flow Tracker |
| **Pattern Recognition** | None | 6 key patterns |
| **Smart Money Detection** | Indirect (flow impact) | Direct (flow analysis) |
| **Multi-timeframe** | No | Yes (D+W+C) |
| **Real-time Confirmation** | No | Yes (RT snapshots) |
| **Entry Quality** | Variable | High (sweet spot filtering) |

---

## 🎯 Scoring Breakdown Example

### Example Signal: BBCA

**Raw NeoBDM Data**:
```python
{
    "symbol": "BBCA",
    "d_0": 125.5,     # Today flow
    "d_2": 95.3,
    "d_3": 110.2,
    "d_4": 88.7,
    "w_1": 420.8,     # This week
    "w_2": 380.5,
    "c_3": 331.0,     # Cumulative
    "c_5": 545.2,
    "c_10": 1025.7,
    "c_20": 2150.3,
    "pct_1d": 1.5,    # Price change
    "price": 8450,
    "unusual": "v",
    "crossing": "",
    "pinky": ""
}
```

**Scoring Calculation**:
```
Base Scores:
  Marker Score: +15 (unusual flag)
  Flow Magnitude: +40 (d_0 = 125M → 100-200M range)
  Price Momentum: +5 (pct_1d = 1.5% → early momentum)
  Synergy Bonus: +20 (flow > 50, price < 3%)

Phase Scores:
  Timeframe Alignment: +50 (D+W+C all positive)
  Momentum Analysis: +30 (accelerating velocity)
  Early Warning: -10 (minor warning)
  Pattern Recognition: +40 (CONSISTENT_ACCUMULATION detected)

Advanced:
  Multi-Method Confluence: +25 (MM + NonRetail aligned)
  Relative Flow: +20 (flow strong for price level)

Total Score: 235 → VERY_STRONG
```

**Detected Patterns**:
- ✅ Consistent Accumulation (+40)
- 🚀 Accelerating Build-up (+30)

**Flow Tracker Enhancement**:
```
RT Status: STRONG_BUYING
RT Net Vol: +3.5M (last 45 min)
RT Big Orders: 8
RT Bonus: +15

Final Score: 250 → VERY_STRONG
```

**Recommendation**: 🔥 **HIGH CONVICTION BUY**

---

## 🚀 Migration Path

### Phase 1: Parallel Testing (Week 1-2)
- Keep existing volume-based Stage 1
- Add new flow-based endpoint
- Compare results side-by-side
- Validate accuracy

### Phase 2: Integration (Week 3)
- Merge both approaches
- Flow-based as primary filter
- Volume data as confirmation
- Unified scoring

### Phase 3: Optimization (Week 4+)
- Fine-tune thresholds
- Add more patterns
- Performance optimization
- Real-time alerts

---

## 📋 Implementation Checklist

### Backend
- [ ] Create `alpha_hunter.py` route file
- [ ] Implement `/stage1/scan` endpoint with filters
- [ ] Add Flow Tracker integration to hot signals
- [ ] Add multi-method confluence bonus
- [ ] Test with live data

### Frontend
- [ ] Create Alpha Hunter Stage 1 page
- [ ] Display hot signals table with patterns
- [ ] Add filter UI (score, flow, price change)
- [ ] Show pattern badges
- [ ] Add ticker detail view

### Testing
- [ ] Backtest against historical data
- [ ] Compare with volume-based approach
- [ ] Validate pattern accuracy
- [ ] Performance benchmarking

---

## 💡 Key Insights

### What Makes a HOT Signal?

**GREEN FLAGS** (High Conviction):
1. ✅ **Consistent Accumulation**: All daily flows positive
2. 🚀 **Accelerating Build-up**: Each day > previous day
3. 📊 **Sideways + High Cumulative**: Price flat, flow building
4. 💰 **Multi-Method Confluence**: MM + NonRetail + Foreign agree
5. ⚡ **RT Confirmation**: Real-time buying pressure

**RED FLAGS** (Avoid):
1. ❌ **Distribution Pattern**: All daily flows negative
2. ⚡ **Sudden Spike**: Today huge, history weak (FOMO trap)
3. 🔥 **Late Entry**: Price already up >5%
4. 📉 **Falling Knife**: Price down >5% + outflow
5. 🚨 **Overbought**: Extended rally + slowing flow

---

## 🎯 Expected Outcomes

### Stage 1 Output (Flow-Based)

**Sample Result**:
```json
{
  "total_signals": 42,
  "filtered_count": 8,
  "signals": [
    {
      "symbol": "BBCA",
      "signal_score": 250,
      "signal_strength": "VERY_STRONG",
      "flow": 125.5,
      "change": 1.5,
      "patterns": [
        {"name": "CONSISTENT_ACCUMULATION", "icon": "✅"},
        {"name": "ACCELERATING_BUILDUP", "icon": "🚀"}
      ],
      "rt_status": "STRONG_BUYING",
      "rt_big_orders": 8,
      "conviction": "HIGH"
    },
    // ... more signals
  ]
}
```

### Usage in Stages 2-4

**Stage 2 (Fund Flow)**: Deep dive into Stage 1 candidates
**Stage 3 (Smart Money)**: Broker analysis for top signals
**Stage 4 (Entry Timing)**: Real-time confirmation for execution

---

## Conclusion

**New Stage 1** is **flow-first, pattern-aware, and timing-sensitive**:

- ✅ Detects accumulation BEFORE breakout
- ✅ Multi-timeframe confirmation
- ✅ Pattern recognition for context
- ✅ Real-time order flow validation
- ✅ Smart vs Dumb money distinction

This approach gives **much earlier** and **higher quality** entry signals compared to volume-based screening.

**Next Step**: Implement `/api/alpha-hunter/stage1/scan` endpoint and test with live

 data.
