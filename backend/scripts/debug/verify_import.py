import sys
import os

# Add current directory to path so we can import modules
sys.path.append(os.getcwd())

try:
    from modules.database import DatabaseManager
    print("Import Successful: DatabaseManager loaded")
except ImportError as e:
    print(f"Import Failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"An error occurred: {e}")
    sys.exit(1)
