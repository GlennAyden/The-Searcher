import os
import logging
from modules.database import DatabaseManager
from rag_client import rag_client
from config import DOWNLOADS_DIR, BASE_DIR

logger = logging.getLogger(__name__)

def sync_disclosures_with_filesystem():
    """
    Checks all corporate disclosures in SQL and removes those whose local files are missing.
    Also removes corresponding entries from ChromaDB.
    """
    db_manager = DatabaseManager()
    all_disclosures = db_manager.get_all_disclosures_paths()
    
    orphans = []
    
    for doc_id, local_path in all_disclosures:
        if not local_path:
            # We don't delete records without paths yet, maybe they are just PENDING
            continue
            
        # Normalize and Resolve path
        path_to_check = local_path.replace('/', os.sep).replace('\\', os.sep)
        full_path = path_to_check
        
        if not os.path.isabs(full_path):
            # Try multiple relative lookups
            options = [
                full_path,
                os.path.join(BASE_DIR, full_path),
                os.path.join(DOWNLOADS_DIR, os.path.basename(full_path)),
                os.path.join(os.getcwd(), full_path),
                os.path.join(os.getcwd(), 'backend', full_path)
            ]
            
            found = False
            for opt in options:
                if os.path.exists(opt):
                    found = True
                    break
            
            if not found:
                orphans.append(doc_id)
        elif not os.path.exists(full_path):
            orphans.append(doc_id)
            
    if orphans:
        logger.info(f"Found {len(orphans)} orphaned disclosures (files missing). Cleaning up...")
        # 1. Delete from ChromaDB
        try:
            rag_client.delete_documents(orphans)
        except Exception as e:
            logger.error(f"Failed to sync ChromaDB: {e}")
            
        # 2. Delete from SQL
        try:
            db_manager.delete_disclosures_by_ids(orphans)
        except Exception as e:
            logger.error(f"Failed to sync SQL: {e}")
            
        return {
            "status": "success",
            "deleted_count": len(orphans),
            "message": f"Successfully cleaned up {len(orphans)} missing documents."
        }
    
    return {
        "status": "success",
        "deleted_count": 0,
        "message": "No orphaned documents found. Database is in sync."
    }

def sync_filesystem_with_db():
    """
    Scans the downloads directory and adds any PDF files not in the database.
    """
    db_manager = DatabaseManager()
    existing_paths = [p for _, p in db_manager.get_all_disclosures_paths()]
    # Normalize paths for comparison (just filename)
    existing_filenames = {os.path.basename(p).lower() for p in existing_paths if p}
    
    new_files = []
    if not os.path.exists(DOWNLOADS_DIR):
        return {"status": "success", "added_count": 0, "message": "Downloads directory does not exist."}
        
    for filename in os.listdir(DOWNLOADS_DIR):
        if filename.lower().endswith(".pdf") and filename.lower() not in existing_filenames:
            # We found a new file.
            file_path = os.path.join("downloads", filename)
            
            # Simple heuristic for ticker: if filename starts with ticker format (e.g. 202412_BBRI_...)
            # but IDX filenames are usually gibberish like 347d55293c_f3a56db422.pdf
            
            record = {
                "ticker": "SYNCED",
                "title": f"Synced: {filename}",
                "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                "download_url": f"local://{filename}", # Unique placeholder
                "local_path": file_path
            }
            db_manager.insert_disclosure(record)
            
            # Mark as DOWNLOADED
            with db_manager._get_conn() as conn:
                conn.execute(
                    "UPDATE idx_disclosures SET processed_status = 'DOWNLOADED' WHERE local_path = ?",
                    (file_path,)
                )
            new_files.append(filename)
            
    return {
        "status": "success",
        "added_count": len(new_files),
        "message": f"Successfully added {len(new_files)} new files to database."
    }
