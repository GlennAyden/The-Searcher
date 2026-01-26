
import pytest
import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add backend to sys.path to allow imports
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from main import app
from db.connection import DatabaseConnection

@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    """Create a temporary database file for the session."""
    db_dir = tmp_path_factory.mktemp("data")
    return str(db_dir / "test_market_sentinel.db")

@pytest.fixture(scope="session")
def init_db(test_db_path):
    """Initialize the database schema."""
    # Use a file-based DB for testing to allow shared access across connections if needed,
    # or use :memory: if isolation is preferred per test. 
    # For now using a temp file to mimic real behavior closely.
    db = DatabaseConnection(db_path=test_db_path)
    return db

@pytest.fixture
def client(init_db):
    """FastAPI TestClient with initialized DB."""
    # We might need to override the app's dependency if it relies on global config
    # For now, assuming routers instantiate repos on the fly.
    # To properly test, we should verify if we need to patch the repository class default params.
    return TestClient(app)

@pytest.fixture
def mock_db_connection(init_db):
    """Provide a direct DB connection for checking state."""
    conn = init_db._get_conn()
    yield conn
    conn.close()
