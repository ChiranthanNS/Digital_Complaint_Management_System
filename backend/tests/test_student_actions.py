import sys
import os
import unittest
from flask import session

# Add app to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import app, get_db

class TestStudentActions(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = 'test_secret_key'
        self.client = app.test_client()
        
        # Setup clean test DB tables if necessary (or use existing)
        self.conn = get_db()
        self.cur = self.conn.cursor()
        
        # Clean previous test entries
        self.cur.execute("DELETE FROM complaints WHERE title LIKE 'Test Complaint%'")
        self.cur.execute("DELETE FROM students WHERE email = 'test_student@example.com'")
        self.conn.commit()

        # Create test student
        self.cur.execute(
            "INSERT INTO students (name, email, phone, password) VALUES (?, ?, ?, ?)",
            ("Test Student", "test_student@example.com", "1234567890", "pbkdf2:hashed_password")
        )
        self.student_id = self.cur.lastrowid
        self.conn.commit()

    def tearDown(self):
        # Clean test entries
        self.cur.execute("DELETE FROM complaints WHERE student_id = ?", (self.student_id,))
        self.cur.execute("DELETE FROM students WHERE student_id = ?", (self.student_id,))
        self.conn.commit()
        self.cur.close()
        self.conn.close()

    def login_student(self):
        with self.client.session_transaction() as sess:
            sess['student_id'] = self.student_id
            sess['student_name'] = "Test Student"

    def test_edit_and_delete_complaint(self):
        # 1. Create a pending complaint directly
        self.cur.execute(
            "INSERT INTO complaints (student_id, category, title, description, priority, status) VALUES (?, ?, ?, ?, ?, ?)",
            (self.student_id, "WiFi Issue", "Test Complaint Old Title", "Test description old", "Medium", "Pending")
        )
        complaint_id = self.cur.lastrowid
        self.conn.commit()

        # Try to edit without login
        res = self.client.post(f"/complaint/edit/{complaint_id}", data={
            "category": "Electrical Issue",
            "title": "Test Complaint New Title",
            "description": "Test description new",
            "priority": "High"
        })
        self.assertEqual(res.status_code, 302)  # Should redirect to login

        # Login student
        self.login_student()

        # 2. Edit complaint successfully
        res = self.client.post(f"/complaint/edit/{complaint_id}", data={
            "category": "Electrical Issue",
            "title": "Test Complaint New Title",
            "description": "Test description new",
            "priority": "High"
        })
        self.assertEqual(res.status_code, 302)  # Should redirect to view_complaints
        
        # Verify in DB
        self.cur.execute("SELECT * FROM complaints WHERE complaint_id = ?", (complaint_id,))
        row = self.cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["title"], "Test Complaint New Title")
        self.assertEqual(row["category"], "Electrical Issue")
        self.assertEqual(row["priority"], "High")

        # 3. Update status to 'In Progress' to check locked editing/deleting
        self.cur.execute("UPDATE complaints SET status = 'In Progress' WHERE complaint_id = ?", (complaint_id,))
        self.conn.commit()

        # Try editing 'In Progress' complaint
        res = self.client.post(f"/complaint/edit/{complaint_id}", data={
            "category": "Electrical Issue",
            "title": "Test Complaint Newer Title",
            "description": "Test description newer",
            "priority": "Low"
        })
        self.assertEqual(res.status_code, 302)
        
        # Verify title did NOT change
        self.cur.execute("SELECT title FROM complaints WHERE complaint_id = ?", (complaint_id,))
        self.assertEqual(self.cur.fetchone()["title"], "Test Complaint New Title")

        # Try deleting 'In Progress' complaint
        res = self.client.post(f"/complaint/delete/{complaint_id}")
        self.assertEqual(res.status_code, 302)
        
        # Verify it is NOT deleted
        self.cur.execute("SELECT COUNT(*) FROM complaints WHERE complaint_id = ?", (complaint_id,))
        self.assertEqual(self.cur.fetchone()[0], 1)

        # 4. Update status back to 'Pending' to check deletion
        self.cur.execute("UPDATE complaints SET status = 'Pending' WHERE complaint_id = ?", (complaint_id,))
        self.conn.commit()

        # Delete complaint
        res = self.client.post(f"/complaint/delete/{complaint_id}")
        self.assertEqual(res.status_code, 302)

        # Verify deletion in DB
        self.cur.execute("SELECT COUNT(*) FROM complaints WHERE complaint_id = ?", (complaint_id,))
        self.assertEqual(self.cur.fetchone()[0], 0)

if __name__ == '__main__':
    unittest.main()
