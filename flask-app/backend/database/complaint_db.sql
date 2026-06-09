-- ============================================================
-- Digital Complaint Management System - SQLite Schema
-- complaint_db.sql
-- ============================================================

-- Enable foreign key support inside SQLite connection explicitly
PRAGMA foreign_keys = ON;

-- ── 1. Table: students ──
CREATE TABLE IF NOT EXISTS students (
    student_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    phone       TEXT NOT NULL,
    password    TEXT NOT NULL,  -- hashed via Werkzeug
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Table: admin ──
CREATE TABLE IF NOT EXISTS admin (
    admin_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL   -- hashed via Werkzeug
);

-- ── 3. Table: complaints ──
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    category        TEXT NOT NULL CHECK(
                        category IN (
                            'WiFi Issue',
                            'Electrical Issue',
                            'Water Problem',
                            'Classroom Issue',
                            'Hostel Issue',
                            'Other'
                        )
                    ),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    priority        TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High')),
    status          TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Resolved')),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- ── 4. Seed Default Admin Account ──
-- password: admin123 (hashed in app.py on startup)
INSERT OR IGNORE INTO admin (username, password)
VALUES ('admin', 'admin123');

-- ── 5. Indexes ──
CREATE INDEX IF NOT EXISTS idx_complaints_student   ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status    ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category  ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_created   ON complaints(created_at);
