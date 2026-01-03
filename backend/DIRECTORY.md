# Backend Directory Organization

## Structure

```
backend/
├── main.py                    # FastAPI application entry point
├── config.py                  # Configuration management
├── requirements.txt           # Python dependencies
├── test_routers.py           # Router import tests
│
├── routes/                    # API routers (modular endpoints)
│   ├── __init__.py
│   ├── dashboard.py
│   ├── news.py
│   ├── disclosures.py
│   ├── scrapers.py
│   ├── neobdm.py
│   └── running_trade.py
│
├── db/                        # Database repositories
│   ├── __init__.py
│   ├── connection.py         # Base connection & schema
│   ├── news_repository.py
│   ├── disclosure_repository.py
│   ├── neobdm_repository.py
│   └── running_trade_repository.py
│
├── modules/                   # Business logic & utilities
│   ├── database.py           # Backward-compatible wrapper
│   ├── sync_utils.py         # File sync utilities
│   ├── scraper_*.py          # Various scrapers
│   └── ...
│
├── data/                      # Data storage
│   ├── database.db           # SQLite database
│   ├── *.json                # JSON storage files
│   └── ...
│
├── logs/                      # Log files
│   ├── scrape_log.txt
│   └── ...
│
├── debug/                     # Debug & verification scripts
│   ├── debug_api_buva.py
│   ├── verify_*.py
│   ├── check_tickers.py
│   └── error_date_picker.png
│
├── scripts/                   # Utility scripts
│   ├── clean_db.py
│   ├── scrape_historical.py
│   └── batch_*.py
│
├── tests/                     # Test files
├── downloads/                 # Downloaded files (PDFs, etc.)
├── chroma_db/                 # ChromaDB vector storage
├── cache/                     # Cache directory
└── utils/                     # Shared utilities (new)
```

## File Organization Rules

### Core Application
- `main.py` - Application entry point only
- `config.py` - Configuration management
- `requirements.txt` - Dependencies

### Domain Code
- `routes/` - API endpoints organized by domain
- `db/` - Database operations (Repository pattern)
- `modules/` - Business logic and scrapers

### Data & Storage
- `data/` - All database and JSON files
- `downloads/` - Downloaded PDFs and documents
- `chroma_db/` - Vector database for RAG
- `cache/` - Temporary cache files

### Development & Debugging
- `debug/` - Debug scripts and test files
- `scripts/` - Utility scripts (one-time operations)
- `tests/` - Unit and integration tests
- `logs/` - Application logs

## Recent Organization Changes

The following files were reorganized:
- **Log files** → Moved to `logs/`
- **Debug scripts** → Moved to `debug/`
- **Utility scripts** → Moved to `scripts/`
- **JSON storage** → Moved to `data/`
- **Images** → Moved to `debug/`

## Excluded from Git

See `.gitignore` for files excluded from version control:
- Cache and temporary files
- Database files (`.db`)
- Log files
- Virtual environment
- IDE configurations
