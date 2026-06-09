# ============================================================
# Digital Complaint Management System - Flask Application
# app.py (SQLite Edition)
# ============================================================

from flask import (
    Flask, render_template, request, redirect,
    url_for, session, flash, jsonify
)
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
from functools import wraps
import os
from datetime import datetime

# Register custom converters for SQLite DATETIME/datetime fields to Python datetime objects
def convert_datetime(val):
    val = val.decode('utf-8')
    try:
        if '.' in val:
            return datetime.strptime(val, '%Y-%m-%d %H:%M:%S.%f')
        return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
    except Exception:
        return val

sqlite3.register_converter("DATETIME", convert_datetime)
sqlite3.register_converter("datetime", convert_datetime)

# ─────────────────────────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────────────────────────
# Set custom template and static folders for frontend/backend separation
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

app = Flask(
    __name__,
    template_folder=os.path.join(FRONTEND_DIR, "templates"),
    static_folder=os.path.join(FRONTEND_DIR, "static")
)
app.secret_key = os.environ.get("SECRET_KEY", "cms_secret_2024_change_in_prod")

# Database path (stored locally in the 'database' folder)
DB_PATH = os.path.join(BASE_DIR, "database", "complaint_db.db")

# ─────────────────────────────────────────────────────────────
# Database Configuration
# ─────────────────────────────────────────────────────────────
def get_db():
    """Return a connection to the local SQLite database with datetime parsing."""
    try:
        # Create database folder if it doesn't exist
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row  # Enables access by column names (e.g., row['email'])
        conn.execute("PRAGMA foreign_keys = ON;")  # Strictly enforce Foreign Keys
        return conn
    except sqlite3.Error as e:
        print(f"[DB ERROR] {e}")
        return None


# ─────────────────────────────────────────────────────────────
# Decorators — authentication guards
# ─────────────────────────────────────────────────────────────
def login_required(f):
    """Ensure the user is logged in as a student."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "student_id" not in session:
            flash("Please log in to continue.", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Ensure the user is logged in as admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_id" not in session:
            flash("Admin access required.", "danger")
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────────────────────
# One-time Initialisation: hash the default admin password
# ─────────────────────────────────────────────────────────────
def init_admin():
    """
    On startup, check if the admin password is still plain-text
    ('admin123') and replace it with the secure hash.
    """
    conn = get_db()
    if not conn:
        return
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM admin WHERE username = ?", ("admin",))
        row = cur.fetchone()
        if row and not row["password"].startswith("pbkdf2:"):
            hashed = generate_password_hash("admin123")
            cur.execute(
                "UPDATE admin SET password = ? WHERE username = ?",
                (hashed, "admin")
            )
            conn.commit()
            print("[INFO] Default admin password hashed successfully.")
    except sqlite3.Error as e:
        print(f"[INIT ERROR] Failed to hash admin password: {e}")
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """Redirect root to student login."""
    return redirect(url_for("login"))


# ═══════════════════════════════════════════════════════════════
# STUDENT AUTH
# ═══════════════════════════════════════════════════════════════

@app.route("/register", methods=["GET", "POST"])
def register():
    """Student registration."""
    if request.method == "POST":
        name     = request.form.get("name",     "").strip()
        email    = request.form.get("email",    "").strip().lower()
        phone    = request.form.get("phone",    "").strip()
        password = request.form.get("password", "").strip()
        confirm  = request.form.get("confirm",  "").strip()

        # Basic validation
        if not all([name, email, phone, password, confirm]):
            flash("All fields are required.", "danger")
            return render_template("register.html")

        if password != confirm:
            flash("Passwords do not match.", "danger")
            return render_template("register.html")

        if len(password) < 6:
            flash("Password must be at least 6 characters.", "danger")
            return render_template("register.html")

        conn = get_db()
        if not conn:
            flash("Database connection error.", "danger")
            return render_template("register.html")

        cur = conn.cursor()
        try:
            # SQL Parameterization to prevent injection
            cur.execute("SELECT student_id FROM students WHERE email = ?", (email,))
            if cur.fetchone():
                flash("Email already registered. Please log in.", "warning")
                return render_template("register.html")

            hashed_pw = generate_password_hash(password)
            cur.execute(
                "INSERT INTO students (name, email, phone, password) VALUES (?, ?, ?, ?)",
                (name, email, phone, hashed_pw)
            )
            conn.commit()
            flash("Registration successful! Please log in.", "success")
            return redirect(url_for("login"))
        except sqlite3.Error as e:
            conn.rollback()
            flash(f"Registration failed: {e}", "danger")
        finally:
            cur.close()
            conn.close()

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    """Student login."""
    if "student_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        email    = request.form.get("email",    "").strip().lower()
        password = request.form.get("password", "").strip()

        conn = get_db()
        if not conn:
            flash("Database connection error.", "danger")
            return render_template("login.html")

        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT * FROM students WHERE email = ?", (email,)
            )
            student = cur.fetchone()
            if student and check_password_hash(student["password"], password):
                session["student_id"]   = student["student_id"]
                session["student_name"] = student["name"]
                flash(f"Welcome back, {student['name']}!", "success")
                return redirect(url_for("dashboard"))
            else:
                flash("Invalid email or password.", "danger")
        finally:
            cur.close()
            conn.close()

    return render_template("login.html")


@app.route("/logout")
def logout():
    """Clear student session."""
    session.clear()
    flash("Logged out successfully.", "info")
    return redirect(url_for("login"))


# ═══════════════════════════════════════════════════════════════
# STUDENT DASHBOARD
# ═══════════════════════════════════════════════════════════════

@app.route("/dashboard")
@login_required
def dashboard():
    """Student dashboard: stats + recent complaints."""
    sid  = session["student_id"]
    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("login"))

    cur = conn.cursor()
    try:
        # SQLite compliant aggregates (SUM values evaluated with CASE WHEN)
        cur.execute("""
            SELECT
                COUNT(*)                                                             AS total,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0)     AS pending,
                COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) AS in_progress,
                COALESCE(SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END), 0)    AS resolved
            FROM complaints
            WHERE student_id = ?
        """, (sid,))
        stats = cur.fetchone()

        # Recent 10 complaints ordered by newest first
        cur.execute("""
            SELECT complaint_id, category, title, priority, status, created_at
            FROM complaints
            WHERE student_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        """, (sid,))
        recent = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    return render_template("dashboard.html", stats=stats, recent=recent)


# ═══════════════════════════════════════════════════════════════
# COMPLAINT CRUD (Student)
# ═══════════════════════════════════════════════════════════════

CATEGORIES = [
    "WiFi Issue",
    "Electrical Issue",
    "Water Problem",
    "Classroom Issue",
    "Hostel Issue",
    "Other",
]


@app.route("/complaint/submit", methods=["GET", "POST"])
@login_required
def submit_complaint():
    """Student submits a new complaint."""
    if request.method == "POST":
        sid         = session["student_id"]
        category    = request.form.get("category",    "").strip()
        title       = request.form.get("title",       "").strip()
        description = request.form.get("description", "").strip()
        priority    = request.form.get("priority",    "Medium").strip()

        if not all([category, title, description]):
            flash("All fields are required.", "danger")
            return render_template("complaint.html", categories=CATEGORIES)

        if category not in CATEGORIES:
            flash("Invalid category selected.", "danger")
            return render_template("complaint.html", categories=CATEGORIES)

        conn = get_db()
        if not conn:
            flash("Database error.", "danger")
            return render_template("complaint.html", categories=CATEGORIES)

        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO complaints
                   (student_id, category, title, description, priority)
                   VALUES (?, ?, ?, ?, ?)""",
                (sid, category, title, description, priority)
            )
            conn.commit()
            flash("Complaint submitted successfully!", "success")
            return redirect(url_for("dashboard"))
        except sqlite3.Error as e:
            conn.rollback()
            flash(f"Submission failed: {e}", "danger")
        finally:
            cur.close()
            conn.close()

    return render_template("complaint.html", categories=CATEGORIES)


@app.route("/complaint/view")
@login_required
def view_complaints():
    """Student views ALL their complaints."""
    sid  = session["student_id"]
    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("dashboard"))

    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT complaint_id, category, title, description,
                   priority, status, created_at
            FROM complaints
            WHERE student_id = ?
            ORDER BY created_at DESC
        """, (sid,))
        complaints = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    # Simple datetime formatter helper if string parsing is required on render,
    # but Jinja handles standard SQLite string dates gracefully.
    return render_template(
        "complaint.html",
        categories=CATEGORIES,
        complaints=complaints,
        view_mode=True
    )


@app.route("/complaint/edit/<int:cid>", methods=["POST"])
@login_required
def student_edit_complaint(cid):
    """Student edits an existing complaint (only if status is 'Pending')."""
    sid = session["student_id"]
    category = request.form.get("category", "").strip()
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    priority = request.form.get("priority", "Medium").strip()

    if not all([category, title, description]):
        flash("All fields are required.", "danger")
        return redirect(url_for("view_complaints"))

    if category not in CATEGORIES:
        flash("Invalid category selected.", "danger")
        return redirect(url_for("view_complaints"))

    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("view_complaints"))

    cur = conn.cursor()
    try:
        # Check ownership and status
        cur.execute("SELECT status FROM complaints WHERE complaint_id = ? AND student_id = ?", (cid, sid))
        complaint = cur.fetchone()
        if not complaint:
            flash("Complaint not found or unauthorized.", "danger")
            return redirect(url_for("view_complaints"))

        if complaint["status"] != "Pending":
            flash("Only pending complaints can be edited.", "warning")
            return redirect(url_for("view_complaints"))

        cur.execute(
            """UPDATE complaints 
               SET category = ?, title = ?, description = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
               WHERE complaint_id = ?""",
            (category, title, description, priority, cid)
        )
        conn.commit()
        flash("Complaint updated successfully!", "success")
    except sqlite3.Error as e:
        conn.rollback()
        flash(f"Update failed: {e}", "danger")
    finally:
        cur.close()
        conn.close()

    return redirect(url_for("view_complaints"))


@app.route("/complaint/delete/<int:cid>", methods=["POST"])
@login_required
def student_delete_complaint(cid):
    """Student deletes a complaint (only if status is 'Pending')."""
    sid = session["student_id"]
    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("view_complaints"))

    cur = conn.cursor()
    try:
        # Check ownership and status
        cur.execute("SELECT status FROM complaints WHERE complaint_id = ? AND student_id = ?", (cid, sid))
        complaint = cur.fetchone()
        if not complaint:
            flash("Complaint not found or unauthorized.", "danger")
            return redirect(url_for("view_complaints"))

        if complaint["status"] != "Pending":
            flash("Only pending complaints can be deleted.", "warning")
            return redirect(url_for("view_complaints"))

        cur.execute("DELETE FROM complaints WHERE complaint_id = ?", (cid,))
        conn.commit()
        flash("Complaint deleted successfully.", "success")
    except sqlite3.Error as e:
        conn.rollback()
        flash(f"Delete failed: {e}", "danger")
    finally:
        cur.close()
        conn.close()

    return redirect(url_for("view_complaints"))


# ═══════════════════════════════════════════════════════════════
# ADMIN AUTH
# ═══════════════════════════════════════════════════════════════

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Admin login page."""
    if "admin_id" in session:
        return redirect(url_for("admin_dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        conn = get_db()
        if not conn:
            flash("Database connection error.", "danger")
            return render_template("login.html", admin_mode=True)

        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT * FROM admin WHERE username = ?", (username,)
            )
            admin = cur.fetchone()
            if admin and check_password_hash(admin["password"], password):
                session["admin_id"]   = admin["admin_id"]
                session["admin_name"] = admin["username"]
                flash("Admin login successful!", "success")
                return redirect(url_for("admin_dashboard"))
            else:
                flash("Invalid admin credentials.", "danger")
        finally:
            cur.close()
            conn.close()

    return render_template("login.html", admin_mode=True)


@app.route("/admin/logout")
def admin_logout():
    """Clear admin session."""
    session.clear()
    flash("Admin logged out.", "info")
    return redirect(url_for("admin_login"))


# ═══════════════════════════════════════════════════════════════
# ADMIN DASHBOARD & MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    """Admin dashboard with statistics and all complaints."""
    # Read filter/search params
    search   = request.args.get("search",   "").strip()
    category = request.args.get("category", "").strip()
    status   = request.args.get("status",   "").strip()

    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("admin_login"))

    cur = conn.cursor()
    try:
        # Overall statistics (SQLite aggregation)
        cur.execute("""
            SELECT
                COUNT(*)                                                             AS total,
                COALESCE(SUM(CASE WHEN c.status = 'Pending' THEN 1 ELSE 0 END), 0)     AS pending,
                COALESCE(SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END), 0) AS in_progress,
                COALESCE(SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END), 0)    AS resolved
            FROM complaints c
            JOIN students s ON c.student_id = s.student_id
        """)
        stats = cur.fetchone()

        # Category-wise breakdown
        cur.execute("""
            SELECT category, COUNT(*) AS cnt
            FROM complaints
            GROUP BY category
            ORDER BY cnt DESC
        """)
        cat_stats = cur.fetchall()

        # Build dynamic WHERE clause for search/filter
        filters  = []
        params   = []

        if search:
            # SQLite supports case-insensitive searches via LIKE
            filters.append(
                "(c.title LIKE ? OR c.description LIKE ? OR s.name LIKE ?)"
            )
            like = f"%{search}%"
            params.extend([like, like, like])

        if category and category in CATEGORIES:
            filters.append("c.category = ?")
            params.append(category)

        if status and status in ("Pending", "In Progress", "Resolved"):
            filters.append("c.status = ?")
            params.append(status)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        # Fetch complaints with student name via JOIN
        cur.execute(f"""
            SELECT
                c.complaint_id, c.category, c.title,
                c.description, c.priority, c.status,
                c.created_at, c.updated_at,
                s.name  AS student_name,
                s.email AS student_email
            FROM complaints c
            JOIN students s ON c.student_id = s.student_id
            {where}
            ORDER BY c.created_at DESC
        """, params)
        complaints = cur.fetchall()

    finally:
        cur.close()
        conn.close()

    return render_template(
        "admin.html",
        stats=stats,
        cat_stats=cat_stats,
        complaints=complaints,
        categories=CATEGORIES,
        search=search,
        sel_category=category,
        sel_status=status,
    )


@app.route("/admin/complaint/update/<int:cid>", methods=["POST"])
@admin_required
def update_complaint(cid):
    """Admin updates the status of a complaint."""
    new_status = request.form.get("status", "").strip()
    if new_status not in ("Pending", "In Progress", "Resolved"):
        flash("Invalid status value.", "danger")
        return redirect(url_for("admin_dashboard"))

    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("admin_dashboard"))

    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?",
            (new_status, cid)
        )
        conn.commit()
        flash("Complaint status updated successfully.", "success")
    except sqlite3.Error as e:
        conn.rollback()
        flash(f"Update failed: {e}", "danger")
    finally:
        cur.close()
        conn.close()

    return redirect(url_for("admin_dashboard"))


@app.route("/admin/complaint/delete/<int:cid>", methods=["POST"])
@admin_required
def delete_complaint(cid):
    """Admin deletes a complaint."""
    conn = get_db()
    if not conn:
        flash("Database error.", "danger")
        return redirect(url_for("admin_dashboard"))

    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM complaints WHERE complaint_id = ?", (cid,)
        )
        conn.commit()
        flash("Complaint deleted.", "success")
    except sqlite3.Error as e:
        conn.rollback()
        flash(f"Delete failed: {e}", "danger")
    finally:
        cur.close()
        conn.close()

    return redirect(url_for("admin_dashboard"))


# ─────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_admin()           # Hash default admin password on first run
    app.run(debug=True, host="0.0.0.0", port=5000)
