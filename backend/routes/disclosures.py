"""Disclosures and RAG chat routes for document management and Q&A."""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
import logging

router = APIRouter(prefix="/api", tags=["disclosures"])


class ChatRequest(BaseModel):
    """Request model for RAG chat."""
    doc_id: int
    doc_title: str
    prompt: str


class OpenFileRequest(BaseModel):
    """Request model for opening local files."""
    file_path: str


@router.get("/disclosures")
async def get_disclosures(
    ticker: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get IDX disclosures with pagination.
    
    Args:
        ticker: Filter by ticker symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        page: Page number for pagination
        limit: Items per page
    """
    from modules.database import DatabaseManager
    db_manager = DatabaseManager()
    
    # Parse dates
    end_dt = datetime.now() if not end_date else datetime.fromisoformat(end_date)
    start_dt = end_dt - timedelta(days=30) if not start_date else datetime.fromisoformat(start_date)
    
    offset = (page - 1) * limit

    # Fetch from DB
    disclosures_raw = db_manager.get_disclosures(
        ticker=ticker if ticker and ticker != "All" and ticker != "^JKSE" else None,
        start_date=start_dt.strftime('%Y-%m-%d'),
        end_date=end_dt.strftime('%Y-%m-%d'),
        limit=limit,
        offset=offset
    )
    
    if disclosures_raw.empty:
        return []
        
    result = []
    for _, row in disclosures_raw.iterrows():
        result.append({
            "id": int(row['id']),
            "date": pd.to_datetime(row['published_date']).strftime('%d %b %Y'),
            "ticker": row['ticker'],
            "title": row['title'],
            "status": row['processed_status'],
            "summary": row.get('ai_summary', ''),
            "local_path": row.get('local_path', '')
        })
    return result


@router.post("/chat")
async def chat_with_document(request: ChatRequest):
    """
    RAG chat endpoint for document Q&A.
    
    Uses vector search to find relevant context and generates answers using LLM.
    """
    try:
        from rag_client import rag_client
        response = await rag_client.aquery(
            doc_id=request.doc_id,
            doc_title=request.doc_title,
            question=request.prompt
        )
        return {"response": response}
    except Exception as e:
        logging.error(f"Chat endpoint error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/sync-disclosures")
async def run_sync_disclosures():
    """
    Synchronize database with physical disclosure files and trigger RAG indexing.
    
    Steps:
    1. Remove orphaned DB records (files that don't exist)
    2. Add missing files from downloads to DB
    3. Trigger RAG indexing for pending documents
    """
    try:
        from modules.sync_utils import sync_disclosures_with_filesystem, sync_filesystem_with_db
        
        # 1. Remove orphans
        sync_result = sync_disclosures_with_filesystem()
        
        # 2. Add missing files from downloads to DB
        scan_result = sync_filesystem_with_db()
        
        # 3. Trigger Indexing for any pending/downloaded docs
        from idx_processor import IDXProcessor
        processor = IDXProcessor()
        processor.run_processor()
        
        return {
            "sync_result": sync_result,
            "scan_result": scan_result,
            "message": "Synchronization and indexing complete."
        }
    except Exception as e:
        import traceback
        logging.error(f"Sync error: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/open-file")
async def open_file(request: OpenFileRequest):
    """
    Open a local file using the system's default application.
    
    Works on Windows, macOS, and Linux.
    """
    import os
    import platform
    import subprocess
    
    try:
        file_path = request.file_path
        
        # Validate file exists
        if not os.path.exists(file_path):
            return JSONResponse(
                status_code=404,
                content={"error": f"File not found: {file_path}"}
            )
        
        # Open based on OS
        system = platform.system()
        
        if system == "Windows":
            os.startfile(file_path)
        elif system == "Darwin":  # macOS
            subprocess.run(["open", file_path])
        else:  # Linux
            subprocess.run(["xdg-open", file_path])
        
        return {
            "status": "success",
            "message": f"Opened {os.path.basename(file_path)}"
        }
        
    except Exception as e:
        logging.error(f"Error opening file: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to open file: {str(e)}"}
        )
