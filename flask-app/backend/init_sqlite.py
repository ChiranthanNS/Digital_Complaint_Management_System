import sqlite3
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "database")
DB_PATH = os.path.join(DB_DIR, "complaint_db.db")
SQL_PATH = os.path.join(DB_DIR, "complaint_db.sql")

print("Initializing local SQLite database...")

# Ensure database directory exists
os.makedirs(DB_DIR, exist_ok=True)

# Remove database if it already exists to start fresh and clean
if os.path.exists(DB_PATH):
    try:
        os.remove(DB_PATH)
        print("Removed existing local database file to build fresh.")
    except Exception as e:
        print(f"Warning: Could not remove old DB file: {e}")

try:
    # Connect to SQLite database file
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    
    # Read the SQL schema file
    print(f"Reading schema script from: {SQL_PATH}")
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        sql_script = f.read()

    # Execute entire schema script
    print("Executing database schema queries...")
    conn.executescript(sql_script)
    conn.commit()
    print("Database built successfully!")
    print(f"Database File: {DB_PATH}")

except Exception as e:
    print(f"Error during SQLite database setup: {e}")
    sys.exit(1)
finally:
    if 'conn' in locals():
        conn.close()
