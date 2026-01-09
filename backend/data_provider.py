import pandas as pd
import yfinance as yf
import plotly.graph_objects as go
import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from plotly.subplots import make_subplots
import config
from modules.database import DatabaseManager

class DataProvider:
    def __init__(self):
        self.db_manager = DatabaseManager()

    def load_news_data(self, ticker: str = None, start_date: datetime = None, end_date: datetime = None, limit: int = None, offset: int = None, sentiment_label: str = None) -> pd.DataFrame:
        """
        Loads and processes news data from SQLite Database.
        """
        # Pass filters to SQL level
        df = self.db_manager.get_news(
            ticker=ticker, 
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            limit=limit,
            offset=offset,
            sentiment_label=sentiment_label
        )
        
        if not df.empty:
            # Convert timestamp to datetime
            df['timestamp'] = pd.to_datetime(df['timestamp'], format='mixed', errors='coerce', utc=True)
            
            # Drop rows where timestamp could not be parsed
            df = df.dropna(subset=['timestamp'])
            
            # Sort by latest
            df = df.sort_values(by='timestamp', ascending=False)
            
            # Ensure sentiment_label is present
            if 'sentiment_label' not in df.columns:
                df['sentiment_label'] = "Netral"
                
            # Reconstruct extracted_tickers from CSV string
            df['extracted_tickers'] = df['ticker'].apply(
                lambda x: [t.strip() for t in x.split(',')] if x else []
            )
                
        return df

    def extract_unique_tickers(self, df: pd.DataFrame) -> List[str]:
        """Extracts unique tickers for the dropdown."""
        if df.empty or 'extracted_tickers' not in df.columns:
            return []
        
        unique_tickers = set()
        for tickers in df['extracted_tickers']:
            unique_tickers.update(tickers)
        
        # Merge with defaults from config
        all_tickers = sorted(list(set(config.DEFAULT_TICKERS + list(unique_tickers))))
        return all_tickers

    def fetch_stock_data(self, ticker: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Fetches OHLC data from yfinance with robust fallback."""
        # Handle index symbols (start with ^) differently
        if ticker.startswith('^'):
            # Index symbols like ^JKSE should be used as-is
            yf_ticker = ticker
        else:
            # Clean ticker from any prefixes (like stars) but preserve alphanumeric
            clean_ticker = "".join(filter(str.isalnum, ticker)).upper()
            
            # Smart suffix for Indonesian individual stocks (4-letter codes)
            # Exclude common index abbreviations
            if len(clean_ticker) == 4 and clean_ticker not in ["COMP", "IHSG", "JKSE"]:
                yf_ticker = f"{clean_ticker}.JK"
            else:
                yf_ticker = clean_ticker
            
        try:
            # Check if this is targeting "Today" or beyond
            # Use a slightly aggressive buffer (e.g., end_date is today or later)
            now = datetime.now()
            is_targeting_today = end_date.date() >= now.date()
            
            if is_targeting_today:
                # 'period' is significantly more reliable for getting the absolutely latest data point
                df = yf.download(yf_ticker, period="1mo", auto_adjust=True, progress=False)
            else:
                df = yf.download(yf_ticker, start=start_date, end=end_date, auto_adjust=True, progress=False)
            
            if df.empty:
                # Fallback to period if specific dates failed
                df = yf.download(yf_ticker, period="1mo", auto_adjust=True, progress=False)
                
            if df.empty:
                return pd.DataFrame()

            # Robust Multi-Index Handling (yfinance v0.2.x layout can vary)
            if isinstance(df.columns, pd.MultiIndex):
                # We need columns like 'Close', 'Open', etc.
                # Usually in level 0, but sometimes Ticker is level 0.
                for i in range(df.columns.nlevels):
                    level_vals = [str(x).lower() for x in df.columns.get_level_values(i)]
                    if 'close' in level_vals:
                        df.columns = df.columns.get_level_values(i)
                        break
                
            return df
        except Exception as e:
            print(f"Error fetching stock data for {yf_ticker}: {e}")
            return pd.DataFrame()

    def _sanitize_float(self, val: any) -> float:
        """Helper to ensure float values are JSON compliant (no NaN/Inf)."""
        try:
            # If it's a series or array, take the last element or first
            if hasattr(val, 'iloc'):
                val = val.iloc[-1]
            elif isinstance(val, (list, np.ndarray)) and len(val) > 0:
                val = val[-1]
                
            f_val = float(val)
            if np.isnan(f_val) or np.isinf(f_val):
                return 0.0
            return f_val
        except (ValueError, TypeError, IndexError):
            return 0.0

    def calculate_stats(self, stock_df: pd.DataFrame, news_df: pd.DataFrame) -> dict:
        """Calculates Price, Mood, Correlation, and Volume stats with 7-day trends."""
        stats = {
            "price": 0.0, "price_delta": 0.0,
            "mood_score": 0.0, "mood_label": "Netral 😐",
            "correlation": 0.0, "volume": len(news_df),
            "trends": {
                "price": [],
                "mood": [],
                "correlation": [],
                "volume": []
            }
        }

        # 1. Price
        if not stock_df.empty:
            stats["price"] = self._sanitize_float(stock_df['Close'].iloc[-1])
            if len(stock_df) >= 2:
                prev = stock_df['Close'].iloc[-2]
                stats["price_delta"] = self._sanitize_float(stats["price"] - prev)
            
            # Trend: last 7 points
            stats["trends"]["price"] = [self._sanitize_float(x) for x in stock_df['Close'].tail(7).tolist()]

        # 2. Mood & Volume Trends
        if not news_df.empty:
            # Aggregate news sentiment daily
            df_agg = news_df.copy()
            df_agg['calc_score'] = df_agg.apply(
                lambda row: row['sentiment_score'] if row['sentiment_label'] == 'Bullish'
                else (-row['sentiment_score'] if row['sentiment_label'] == 'Bearish' else 0),
                axis=1
            )
            # Match market timezone (Jakarta)
            df_agg['date'] = df_agg['timestamp'].dt.tz_convert('Asia/Jakarta').dt.normalize()
            daily_stats = df_agg.groupby('date').agg(
                score=('calc_score', 'mean'),
                count=('title', 'count')
            ).reset_index().sort_values('date')

            # Current Mood
            scores = df_agg['calc_score'].tolist()
            stats["mood_score"] = self._sanitize_float(sum(scores) / len(scores) if scores else 0)
            
            if stats["mood_score"] > 0.1: stats["mood_label"] = "Bullish 🐂"
            elif stats["mood_score"] < -0.1: stats["mood_label"] = "Bearish 🐻"

            # Trends: last 7 days
            stats["trends"]["mood"] = [self._sanitize_float(x) for x in daily_stats['score'].tail(7).tolist()]
            stats["trends"]["volume"] = [int(x) for x in daily_stats['count'].tail(7).tolist()]

        # 3. Correlation
        if not stock_df.empty and not news_df.empty:
            # Align stock data (ensure UTC and normalize)
            s_df = stock_df.copy()
            if s_df.index.tz is None:
                s_df.index = s_df.index.tz_localize('UTC')
            else:
                s_df.index = s_df.index.tz_convert('UTC')
            s_df.index = s_df.index.normalize()
            
            # We already have daily_stats from step 2 if news_df not empty
            merged = pd.merge(s_df, daily_stats, left_index=True, right_on='date', how='left').fillna(0)
            
            if not merged.empty and len(merged) > 1:
                # Avoid division by zero warnings if variance is zero
                if merged['Close'].std() > 0 and merged['score'].std() > 0:
                    stats["correlation"] = self._sanitize_float(merged['Close'].corr(merged['score']))
                    
                    # Rolling correlation for trend (min 3 points to show something)
                    if len(merged) >= 5:
                        rolling_corr = merged['Close'].rolling(window=5).corr(merged['score'])
                        stats["trends"]["correlation"] = [self._sanitize_float(x) for x in rolling_corr.tail(7).tolist()]
                    else:
                        stats["trends"]["correlation"] = [stats["correlation"]] * min(len(merged), 7)
                else:
                    stats["correlation"] = 0.0
                    stats["trends"]["correlation"] = [0.0] * min(len(merged), 7)

        return stats

    def create_chart(self, stock_df: pd.DataFrame, news_df: pd.DataFrame, ticker: str) -> go.Figure:
        """Replicates the dual-axis chart logic."""
        
        # Aggregate sentiment
        if news_df.empty:
            daily_sentiment = pd.DataFrame()
        else:
            df_agg = news_df.copy()
            df_agg['calc_score'] = df_agg.apply(
                lambda row: row['sentiment_score'] if row['sentiment_label'] == 'Bullish'
                else (-row['sentiment_score'] if row['sentiment_label'] == 'Bearish' else 0),
                axis=1
            )
            df_agg['date'] = df_agg['timestamp'].dt.normalize()
            daily_sentiment = df_agg.groupby('date').agg(
                calc_score=('calc_score', 'mean'),
                news_count=('title', 'count')
            ).reset_index().sort_values('date')
            daily_sentiment['ma_sentiment'] = daily_sentiment['calc_score'].rolling(window=5, min_periods=1).mean()

        # Build Chart
        fig = make_subplots(
            rows=2, cols=1, 
            shared_xaxes=True, 
            vertical_spacing=0.03, 
            row_heights=[0.7, 0.3],
            specs=[[{"type": "xy"}], [{"type": "xy"}]]
        )

        # Candle
        if not stock_df.empty:
            fig.add_trace(
                go.Candlestick(
                    x=stock_df.index,
                    open=stock_df['Open'], high=stock_df['High'],
                    low=stock_df['Low'], close=stock_df['Close'],
                    name=f"{ticker} Price"
                ), row=1, col=1
            )

        # Sentiment
        if not daily_sentiment.empty:
            colors = ['#00cc00' if x > 0 else '#cc0000' for x in daily_sentiment['calc_score']]
            fig.add_trace(
                go.Bar(
                    x=daily_sentiment['date'], y=daily_sentiment['calc_score'],
                    name="Avg Sentiment", marker_color=colors
                ), row=2, col=1
            )
            fig.add_trace(
                go.Scatter(
                    x=daily_sentiment['date'], y=daily_sentiment['ma_sentiment'],
                    name="Trend (5-MA)", line=dict(color='#FFD700', width=2)
                ), row=2, col=1
            )

        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#E3E3E3'),
            xaxis=dict(gridcolor='#333', type='date', rangeslider_visible=False),
            yaxis=dict(gridcolor='#333'),
            margin=dict(l=0, r=0, t=10, b=0),
            height=600,
            showlegend=False
        )
        return fig
    
    def get_market_cap(self, symbol: str) -> Optional[float]:
        """
        Get market cap with automatic caching (24h TTL).
        
        Args:
            symbol: Stock ticker (e.g., "BBCA")
            
        Returns:
            Market cap in IDR, or None if unavailable
        """
        return self.db_manager.get_market_cap(symbol)
    
    def calculate_flow_impact(self, flow_billions: float, market_cap: float) -> dict:
        """
        Calculate normalized flow impact metrics.
        
        Args:
            flow_billions: Money flow in billions (from NeoBDM)
            market_cap: Market cap in IDR
            
        Returns:
            {
                'flow_idr': flow dalam Rupiah,
                'impact_pct': flow as % of market cap,
                'impact_label': 'EXTREME', 'HIGH', 'MODERATE', 'LOW', 'MINIMAL'
            }
        """
        flow_idr = flow_billions * 1_000_000_000
        impact_pct = (flow_idr / market_cap) * 100 if market_cap > 0 else 0
        
        if impact_pct > 5.0:
            label = "EXTREME"
        elif impact_pct > 2.0:
            label = "HIGH"
        elif impact_pct > 1.0:
            label = "MODERATE"
        elif impact_pct > 0.5:
            label = "LOW"
        else:
            label = "MINIMAL"
        
        return {
            'flow_idr': flow_idr,
            'impact_pct': round(impact_pct, 3),
            'impact_label': label
        }

data_provider = DataProvider()

