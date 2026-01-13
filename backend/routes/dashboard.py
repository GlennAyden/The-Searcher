"""Dashboard routes for market statistics, market data, and sentiment analysis."""
from fastapi import APIRouter
from datetime import datetime, timedelta
from typing import Optional

from data_provider import data_provider

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/tickers")
async def get_tickers():
    """Get list of all available tickers from news data."""
    df = data_provider.load_news_data()
    tickers = data_provider.extract_unique_tickers(df)
    return {"tickers": tickers}


@router.get("/issuer-tickers")
async def get_issuer_tickers():
    """Get master list of issuer tickers from the local IDX map."""
    try:
        from modules.utils import load_ticker_map, TICKER_MAP
        load_ticker_map()
        tickers = sorted(list(TICKER_MAP.keys()))
        return {"tickers": tickers}
    except Exception:
        return {"tickers": []}


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    ticker: str = "^JKSE",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get comprehensive dashboard statistics including price, sentiment correlation, etc.
    
    Args:
        ticker: Stock symbol (default: ^JKSE for Jakarta Composite Index)
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    """
    # Parse dates
    if end_date:
        end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
    else:
        end_dt = datetime.now()
        
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = end_dt - timedelta(days=30)
    
    # Load news with SQL filtering
    filtered_news = data_provider.load_news_data(
        ticker=ticker if ticker != "^JKSE" else None,
        start_date=start_dt,
        end_date=end_dt
    )

    # Fetch stock data
    stock_df = data_provider.fetch_stock_data(ticker, start_dt, end_dt)
    
    # Calculate statistics
    stats = data_provider.calculate_stats(stock_df, filtered_news)
    return stats


@router.get("/market-data")
async def get_market_data(
    ticker: str = "^JKSE",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get OHLC market data for charting.
    
    Returns:
        List of market data with timestamp, open, high, low, close
    """
    if end_date:
        end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
    else:
        end_dt = datetime.now()
        
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = end_dt - timedelta(days=30)
    
    stock_df = data_provider.fetch_stock_data(ticker, start_dt, end_dt)
    
    if stock_df.empty:
        return []
        
    # Standardize output for Recharts
    chart_data = []
    for idx, row in stock_df.iterrows():
        chart_data.append({
            "timestamp": idx.strftime('%Y-%m-%d'),
            "open": float(row['Open']),
            "high": float(row['High']),
            "low": float(row['Low']),
            "close": float(row['Close']),
        })
    return chart_data


@router.get("/sentiment-data")
async def get_sentiment_data(
    ticker: str = "^JKSE",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get aggregated daily sentiment data with simple moving average.
    
    Returns:
        List of daily sentiment scores with SMA
    """
    if end_date:
        end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
    else:
        end_dt = datetime.now()
        
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = end_dt - timedelta(days=30)
    
    # Load filtered news
    filtered_news = data_provider.load_news_data(
        ticker=ticker if ticker != "^JKSE" else None,
        start_date=start_dt,
        end_date=end_dt
    )

    if filtered_news.empty:
        return []
        
    # Aggregate daily
    df_agg = filtered_news.copy()
    df_agg['calc_score'] = df_agg.apply(
        lambda row: row['sentiment_score'] if row['sentiment_label'] == 'Bullish'
        else (-row['sentiment_score'] if row['sentiment_label'] == 'Bearish' else 0),
        axis=1
    )
    
    # Convert to Jakarta TZ before normalizing to daily dates
    df_agg['date'] = df_agg['timestamp'].dt.tz_convert('Asia/Jakarta').dt.normalize()
    daily_sentiment = df_agg.groupby('date').agg(
        score=('calc_score', 'mean'),
        count=('title', 'count')
    ).reset_index().sort_values('date')
    
    # Calculate Simple Moving Average
    daily_sentiment['sma'] = daily_sentiment['score'].rolling(window=5, min_periods=1).mean()
    
    result = []
    for _, row in daily_sentiment.iterrows():
        result.append({
            "date": row['date'].strftime('%Y-%m-%d'),
            "score": float(row['score']),
            "sma": float(row['sma']),
            "count": int(row['count'])
        })
    return result
