"""News and word cloud routes for news library feature."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional
from collections import Counter
from wordcloud import WordCloud
import pandas as pd
import io
import base64
import functools

from langchain_ollama import ChatOllama
from data_provider import data_provider

router = APIRouter(prefix="/api", tags=["news"])


@functools.lru_cache()
def get_llm():
    """Get cached LLM instance for news insights."""
    return ChatOllama(model="llama3.2:latest", temperature=0)


@router.get("/news")
async def get_news(
    ticker: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sentiment: str = "All",
    source: str = "All"
):
    """
    Get filtered news articles with sentiment labels.
    
    Args:
        ticker: Filter by ticker symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        sentiment: Filter by sentiment (All, Bullish Only, Bearish Only, Netral Only)
        source: Filter by source (All, CNBC, EmitenNews, IDX)
    """
    try:
        # Parse dates
        end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
        start_dt = end_dt - timedelta(days=30) if not start_date else datetime.fromisoformat(start_date)

        sentiment_label = None
        if sentiment == "Bullish Only": 
            sentiment_label = "Bullish"
        elif sentiment == "Bearish Only": 
            sentiment_label = "Bearish"
        elif sentiment == "Netral Only": 
            sentiment_label = "Netral"

        news_df = data_provider.db_manager.get_news(
            ticker=ticker,
            start_date=start_dt.strftime('%Y-%m-%d'),
            end_date=end_dt.strftime('%Y-%m-%d'),
            sentiment_label=sentiment_label,
            source=source
        )

        if news_df.empty:
            return []

        result = []
        for _, row in news_df.iterrows():
            # Source parsing for the UI
            try:
                url = row.get('url', '')
                if "cnbcindonesia.com" in url: 
                    s_name = "CNBC"
                elif "emitennews.com" in url: 
                    s_name = "EmitenNews"
                elif "idx.co.id" in url: 
                    s_name = "IDX"
                else: 
                    s_name = "Web"
            except:
                s_name = "News"

            result.append({
                "id": row.get('url'),
                "date": pd.to_datetime(row['timestamp']).strftime('%d %b %Y, %H:%M'),
                "ticker": str(row['ticker']) if pd.notna(row['ticker']) else "-",
                "label": row['sentiment_label'],
                "score": float(row['sentiment_score']) if pd.notna(row['sentiment_score']) else 0.0,
                "title": row['title'],
                "url": row['url'],
                "source": s_name
            })
        return result
    except Exception as e:
        import traceback
        error_msg = f"News API Error: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(status_code=500, content={"error": error_msg})


@router.get("/brief-single")
async def brief_single(
    title: str,
    ticker: Optional[str] = None
):
    """
    Generate AI insight for a single news article.
    
    Returns 4-sentence comprehensive summary in flowing paragraph format.
    """
    try:
        llm = get_llm()
        context = f"Terkait emiten {ticker}" if ticker and ticker != "-" else "Terkait pasar modal Indonesia"
        prompt = f"""You are a senior stock market analyst.
Analisa berita berikut dan buatkan rangkuman komprehensif dalam Bahasa Indonesia.
Rangkuman HARUS berupa satu paragraf mengalir yang terdiri dari tepat 4 kalimat.
JANGAN gunakan label seperti "Inti kejadian:", "Latar belakang:", dll. Gabungkan poin-poin berikut secara natural:
1. Inti kejadian/berita.
2. Latar belakang singkat.
3. Dampak langsung ke emiten/pasar.
4. Prospek/rekomendasi singkat untuk investor.

Berita: {title}
{context}

Rangkuman (Paragraf Mengalir):"""
        
        response = llm.invoke(prompt)
        return {"brief": response.content}
    except Exception as e:
        return {"brief": f"Insight failed: {str(e)}"}


@router.get("/brief-news")
async def brief_news(
    ticker: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sentiment: str = "All",
    source: str = "All"
):
    """
    Generate AI summary for a collection of news articles.
    
    Returns 3-5 bullet point summary of filtered news.
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    
    # Parse dates
    end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
    start_dt = end_dt - timedelta(days=7) if not start_date else datetime.fromisoformat(start_date)

    sentiment_label = None
    if sentiment == "Bullish Only": 
        sentiment_label = "Bullish"
    elif sentiment == "Bearish Only": 
        sentiment_label = "Bearish"
    elif sentiment == "Netral Only": 
        sentiment_label = "Netral"

    news_df = db_manager.get_news(
        ticker=ticker,
        start_date=start_dt.strftime('%Y-%m-%d'),
        end_date=end_dt.strftime('%Y-%m-%d'),
        sentiment_label=sentiment_label,
        source=source,
        limit=30  # Summarize up to 30 latest
    )

    if news_df.empty:
        return {"brief": "No news found to summarize for current filters."}

    # Prepare text for LLM
    titles = [f"- {row['title']}" for _, row in news_df.iterrows()]
    text_to_summarize = "\n".join(titles)
    
    try:
        llm = get_llm()
        prompt = f"""You are a senior stock market analyst. 
Summarize the following Indonesian market news into 3-5 concise bullet points in Indonesian language. 
Ignore redundant info. Focus on what matters for investors.

News Headlines:
{text_to_summarize}

Summary:"""
        
        response = llm.invoke(prompt)
        return {"brief": response.content}
    except Exception as e:
        return {"brief": f"Briefing failed: {str(e)}"}


@router.get("/ticker-counts")
async def get_ticker_counts(
    ticker: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get count of news mentions per ticker for trending analysis.
    """
    # Date filter
    end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
    start_dt = end_dt - timedelta(days=30) if not start_date else datetime.fromisoformat(start_date)

    filtered_df = data_provider.load_news_data(
        ticker=ticker if ticker and ticker != "^JKSE" and ticker != "All" else None,
        start_date=start_dt,
        end_date=end_dt
    )
    
    if filtered_df.empty:
        return {"counts": []}
        
    all_tickers = []
    for tickers in filtered_df['extracted_tickers']:
        if isinstance(tickers, list):
            for t in tickers:
                clean_t = t.replace(".JK", "").strip()
                if clean_t and clean_t != "-":
                    all_tickers.append(clean_t)
                    
    if not all_tickers:
        return {"counts": []}
        
    ticker_counts = Counter(all_tickers)
    result = [{"ticker": t, "count": c} for t, c in ticker_counts.most_common(50)]
    
    return {"counts": result}


@router.get("/wordcloud")
async def get_wordcloud(
    ticker: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Generate word cloud image from ticker mentions in news.
    
    Returns base64-encoded PNG image.
    """
    # Date filter
    end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
    start_dt = end_dt - timedelta(days=30) if not start_date else datetime.fromisoformat(start_date)

    filtered_df = data_provider.load_news_data(
        ticker=ticker if ticker and ticker != "^JKSE" and ticker != "All" else None,
        start_date=start_dt,
        end_date=end_dt
    )
    
    if filtered_df.empty:
        return {"image": None}
        
    # Extract all tickers
    all_tickers = []
    for tickers in filtered_df['extracted_tickers']:
        if isinstance(tickers, list):
            for t in tickers:
                clean_t = t.replace(".JK", "").strip()
                if clean_t and clean_t != "-":
                    all_tickers.append(clean_t)
                    
    if not all_tickers:
        return {"image": None}
        
    ticker_counts = Counter(all_tickers)
    
    # Generate word cloud
    wc = WordCloud(
        width=800, 
        height=400, 
        background_color=None, 
        mode='RGBA',
        colormap='plasma',
        min_font_size=12,
        prefer_horizontal=0.9
    ).generate_from_frequencies(ticker_counts)
    
    # Convert to base64
    img_buffer = io.BytesIO()
    wc.to_image().save(img_buffer, format='PNG')
    img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
    
    return {"image": f"data:image/png;base64,{img_base64}"}
