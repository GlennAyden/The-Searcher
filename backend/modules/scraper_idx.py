from curl_cffi import requests
import datetime
import os
import json
import time
from modules.database import DatabaseManager

# Constants
# Correct Endpoint identified by Browser Subagent
IDX_API_URL = "https://www.idx.co.id/primary/ListedCompany/GetAnnouncement"
REFERER_URL = "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def fetch_idx_disclosures(ticker=None, date_from=None, date_to=None, limit=None, save_to_db=False):
    """
    Fetches Corporate Disclosures from IDX API.
    
    Args:
        ticker (str, optional): Stock ticker code.
        date_from (str/datetime): Start date.
        date_to (str/datetime): End date.
        limit (int, optional): Max records.
        save_to_db (bool): If True, saves metadata to SQLite (status: PENDING).

    Returns:
        list: List of dictionaries containing disclosure details.
    """
    
    # Handle dates
    if not date_from:
        date_from = datetime.date.today().strftime("%Y%m%d")
    elif isinstance(date_from, (datetime.date, datetime.datetime)):
        date_from = date_from.strftime("%Y%m%d")
    else:
        date_from = date_from.replace("-", "")

    if not date_to:
        date_to = datetime.date.today().strftime("%Y%m%d")
    elif isinstance(date_to, (datetime.date, datetime.datetime)):
        date_to = date_to.strftime("%Y%m%d")
    else:
        date_to = date_to.replace("-", "")

    # Session setup
    s = requests.Session(impersonate="chrome120")
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Referer": REFERER_URL,
        "Accept": "application/json, text/plain, */*",
    })
    
    # Warm up
    try:
        s.get(REFERER_URL, timeout=10)
    except Exception:
        pass

    # DB Init if needed
    db = DatabaseManager() if save_to_db else None

    results = []
    current_index = 0
    page_size = 100 
    
    print(f"Fetching IDX disclosures for ticker={ticker}, range={date_from}-{date_to}...")

    while True:
        if limit and len(results) >= limit:
            break

        current_request_size = page_size
        if limit:
            remaining = limit - len(results)
            if remaining < page_size:
                current_request_size = remaining

        params = {
            "kodeEmiten": ticker if ticker else "",
            "emitenType": "*",
            "indexFrom": current_index,
            "pageSize": current_request_size,
            "dateFrom": date_from,
            "dateTo": date_to,
            "lang": "id",
            "keyword": ""
        }
        
        try:
            response = s.get(IDX_API_URL, params=params, timeout=30)
            if response.status_code != 200:
                print(f"Error: Received status code {response.status_code}")
                break
                
            data = response.json()
            replies = data.get("Replies", [])
            
            if not replies:
                break
                
            for item in replies:
                pengumuman = item.get("pengumuman", {})
                attachments = item.get("attachments", [])
                
                if not attachments:
                    continue
                    
                title = pengumuman.get("JudulPengumuman", "No Title")
                pub_date = pengumuman.get("TglPengumuman", "") 
                item_ticker = pengumuman.get("Kode_Emiten", ticker)
                
                for att in attachments:
                    download_url = att.get("FullSavePath", "")
                    original_filename = att.get("OriginalFilename", "")
                    
                    if not download_url:
                        continue
                        
                    file_id = download_url.split("/")[-1]

                    record = {
                        "date": pub_date,
                        "ticker": item_ticker,
                        "title": title,
                        "download_url": download_url,
                        "file_id": file_id,
                        "filename": original_filename,
                        "local_path": "" # Initially empty until downloaded
                    }
                    
                    results.append(record)

                    # Save to DB immediately if requested
                    if save_to_db and db:
                        db.insert_disclosure(record)

            print(f"  Fetched items {current_index+1} to {current_index + len(replies)}...")
            current_index += len(replies)
            
            if len(replies) < current_request_size:
                break
                
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Error fetching page {current_index}: {e}")
            break

    print(f"Total PDFs found: {len(results)}")
    return results

def download_pdf(url, save_dir):
    """
    Downloads a PDF using curl_cffi.
    """
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    filename = url.split("/")[-1]
    filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '.', '_', '-')]).strip()
    save_path = os.path.join(save_dir, filename)

    try:
        s = requests.Session(impersonate="chrome120")
        s.headers.update({"Referer": REFERER_URL})
        
        response = s.get(url, timeout=30)
        
        if response.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(response.content)
            return save_path
        else:
            print(f"Failed to download {url}: Status {response.status_code}")
            return None
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return None

def fetch_and_save_pipeline(ticker=None, days=30, download_dir="downloads", start_date=None, end_date=None):
    db = DatabaseManager()
    
    # Determine date range
    if start_date and end_date:
        # Use provided dates
        s_date = start_date
        e_date = end_date
    else:
        # Default to 'days' lookback
        s_date = datetime.date.today() - datetime.timedelta(days=days)
        e_date = datetime.date.today()
    
    print(f"[*] Starting IDX Scraper Pipeline for ticker: {ticker or 'ALL'}")
    print(f"[*] Date Range: {s_date} to {e_date}")
    
    # 1. Fetch & Save Metadata
    disclosures = fetch_idx_disclosures(
        ticker=ticker, 
        date_from=s_date, 
        date_to=e_date, 
        save_to_db=True
    )
    
    if not disclosures:
        print("[-] No disclosures found.")
        return []
    
    # 2. Download and Update DB
    downloaded_count = 0
    for item in disclosures:
        url = item['download_url']
        print(f"Downloading {item['filename']}...")
        local_path = download_pdf(url, download_dir)
        
        if local_path:
            # Update DB with local path
            # We can use insert_disclosure again since it likely does nothing on conflict? 
            # Or better, run a specific UPDATE query. 
            # For simplicity, let's use a quick SQL execution here or add update method.
            # Since insert_disclosure uses IGNORE, we need an UPDATE method.
            # But for this task, I'll direct SQL update.
            with db._get_conn() as conn:
                conn.execute(
                    "UPDATE idx_disclosures SET local_path = ?, processed_status = 'DOWNLOADED' WHERE download_url = ?",
                    (local_path, url)
                )
    
    print("Pipeline complete.")
