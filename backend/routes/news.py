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


# --- STORY FINDER ---

# Default keywords for corporate action tracking
DEFAULT_STORY_KEYWORDS = {
    "right issue": {"category": "Equity Raise", "icon": "🔄", "aliases": ["rights issue", "right issues"]},
    "akuisisi": {"category": "M&A", "icon": "🏢", "aliases": ["acquisition", "mengakuisisi", "diakuisisi"]},
    "merger": {"category": "M&A", "icon": "🏢", "aliases": ["penggabungan"]},
    "dividen": {"category": "Dividend", "icon": "💰", "aliases": ["dividend", "pembagian dividen"]},
    "stock split": {"category": "Split", "icon": "📊", "aliases": ["pemecahan saham"]},
    "reverse split": {"category": "Split", "icon": "📊", "aliases": ["reverse stock split"]},
    "buyback": {"category": "Buyback", "icon": "💵", "aliases": ["beli kembali saham", "pembelian kembali"]},
    "tender offer": {"category": "Tender", "icon": "📋", "aliases": ["penawaran tender"]},
    "delisting": {"category": "Listing", "icon": "⚠️", "aliases": ["penghapusan pencatatan"]},
    "relisting": {"category": "Listing", "icon": "✅", "aliases": ["pencatatan kembali"]},
    "ipo": {"category": "IPO", "icon": "🚀", "aliases": ["initial public offering", "penawaran umum perdana"]},
}


def find_keyword_positions(text: str, keyword: str) -> list:
    """Find all positions of a keyword in text (case-insensitive)."""
    positions = []
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    start = 0
    while True:
        pos = text_lower.find(keyword_lower, start)
        if pos == -1:
            break
        positions.append([pos, pos + len(keyword)])
        start = pos + 1
    return positions


@router.get("/story-finder")
async def get_story_finder(
    keywords: str = "right issue,akuisisi,dividen",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ticker: Optional[str] = None
):
    """
    Find news stories containing specified keywords with highlight positions.
    
    Args:
        keywords: Comma-separated list of keywords to search for
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        ticker: Filter by ticker symbol
        
    Returns:
        stories: List of matching stories with highlight positions
        keyword_stats: Count of matches per keyword
        total: Total number of matching stories
    """
    try:
        # Parse dates
        end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
        start_dt = end_dt - timedelta(days=30) if not start_date else datetime.fromisoformat(start_date)
        
        # Parse keywords
        keyword_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
        
        # Build expanded keyword list with aliases
        expanded_keywords = {}
        for kw in keyword_list:
            if kw in DEFAULT_STORY_KEYWORDS:
                info = DEFAULT_STORY_KEYWORDS[kw]
                expanded_keywords[kw] = {
                    "category": info["category"],
                    "icon": info["icon"],
                    "search_terms": [kw] + info.get("aliases", [])
                }
            else:
                # Custom keyword
                expanded_keywords[kw] = {
                    "category": "Custom",
                    "icon": "🔍",
                    "search_terms": [kw]
                }
        
        # Get news from database
        news_df = data_provider.db_manager.get_news(
            ticker=ticker if ticker and ticker != "All" else None,
            start_date=start_dt.strftime('%Y-%m-%d'),
            end_date=end_dt.strftime('%Y-%m-%d'),
            limit=500  # Get more for keyword filtering
        )
        
        if news_df.empty:
            return {"stories": [], "keyword_stats": {}, "total": 0}
        
        stories = []
        keyword_stats = {kw: 0 for kw in keyword_list}
        
        for _, row in news_df.iterrows():
            title = str(row.get('title', ''))
            clean_text = str(row.get('clean_text', ''))
            search_text = (title + " " + clean_text).lower()
            
            # Find matching keywords
            matched_keywords = []
            all_positions = []
            
            for main_kw, info in expanded_keywords.items():
                for search_term in info["search_terms"]:
                    if search_term in search_text:
                        if main_kw not in matched_keywords:
                            matched_keywords.append(main_kw)
                            keyword_stats[main_kw] += 1
                        
                        # Find positions in title for highlighting
                        title_positions = find_keyword_positions(title, search_term)
                        all_positions.extend(title_positions)
                        break  # Found match for this keyword, move to next
            
            if matched_keywords:
                # Determine source
                url = str(row.get('url', ''))
                if "cnbcindonesia.com" in url:
                    source = "CNBC"
                elif "emitennews.com" in url:
                    source = "EmitenNews"
                elif "idx.co.id" in url:
                    source = "IDX"
                elif "bisnis.com" in url:
                    source = "Bisnis.com"
                elif "investor.id" in url:
                    source = "Investor.id"
                else:
                    source = "Web"
                
                # Get primary keyword info
                primary_kw = matched_keywords[0]
                kw_info = expanded_keywords[primary_kw]
                
                stories.append({
                    "id": url,
                    "date": pd.to_datetime(row['timestamp']).strftime('%Y-%m-%d'),
                    "date_display": pd.to_datetime(row['timestamp']).strftime('%d %b %Y, %H:%M'),
                    "ticker": str(row['ticker']) if pd.notna(row['ticker']) else "-",
                    "title": title,
                    "matched_keywords": matched_keywords,
                    "primary_category": kw_info["category"],
                    "primary_icon": kw_info["icon"],
                    "highlight_positions": all_positions,
                    "sentiment_label": row.get('sentiment_label', 'Netral'),
                    "sentiment_score": float(row['sentiment_score']) if pd.notna(row.get('sentiment_score')) else 0.0,
                    "source": source,
                    "url": url
                })
        
        # Sort by date descending
        stories.sort(key=lambda x: x['date'], reverse=True)
        
        return {
            "stories": stories,
            "keyword_stats": keyword_stats,
            "total": len(stories)
        }
        
    except Exception as e:
        import traceback
        error_msg = f"Story Finder Error: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(status_code=500, content={"error": error_msg})


@router.get("/story-finder/keywords")
async def get_available_keywords():
    """Get list of available default keywords with categories and icons."""
    return {
        "keywords": [
            {"keyword": kw, "category": info["category"], "icon": info["icon"]}
            for kw, info in DEFAULT_STORY_KEYWORDS.items()
        ]
    }
