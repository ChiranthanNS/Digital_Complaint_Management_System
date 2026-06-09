/**
 * Digital Complaint Management System — Pure Client-side JS
 * app.js (LocalStorage Edition for GitHub Pages)
 */

// Default Seed Data
const DEFAULT_STUDENTS = [
    {
        student_id: 1,
        name: "Demo Student",
        email: "student@example.com",
        phone: "9876543210",
        password: "student123" // In production use hashing, here simple text for mock
    }
];

const DEFAULT_COMPLAINTS = [
    {
        complaint_id: 101,
        student_id: 1,
        student_name: "Demo Student",
        student_email: "student@example.com",
        category: "WiFi Issue",
        title: "Hostel block-4 WiFi frequently disconnecting",
        description: "The WiFi access point in block-4 corridor drops connection every 10 minutes, making it impossible to attend online lectures.",
        priority: "High",
        status: "Pending",
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        complaint_id: 102,
        student_id: 1,
        student_name: "Demo Student",
        student_email: "student@example.com",
        category: "Water Problem",
        title: "No water in Block C floor-2 bathrooms",
        description: "Since this morning, there has been zero water supply in the restrooms of the second floor of Block C.",
        priority: "Medium",
        status: "In Progress",
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        updated_at: new Date().toISOString()
    },
    {
        complaint_id: 103,
        student_id: 1,
        student_name: "Demo Student",
        student_email: "student@example.com",
        category: "Electrical Issue",
        title: "Flickering lights in Classroom 302",
        description: "The tube light on the left side of Classroom 302 is flickering continuously, causing eye strain during classes.",
        priority: "Low",
        status: "Resolved",
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    }
];

const CATEGORIES = [
    "WiFi Issue",
    "Electrical Issue",
    "Water Problem",
    "Classroom Issue",
    "Hostel Issue",
    "Other"
];

// App State
let state = {
    currentUser: null,  // { id, name, email, role: 'student'|'admin' }
    students: [],
    complaints: [],
    currentScreen: 'login', // 'login', 'register', 'dashboard', 'submit', 'my-complaints', 'admin-dashboard'
    adminMode: false
};

// Initialize Storage
function initStorage() {
    if (!localStorage.getItem('cms_students')) {
        localStorage.setItem('cms_students', JSON.stringify(DEFAULT_STUDENTS));
    }
    if (!localStorage.getItem('cms_complaints')) {
        localStorage.setItem('cms_complaints', JSON.stringify(DEFAULT_COMPLAINTS));
    }
    state.students = JSON.parse(localStorage.getItem('cms_students'));
    state.complaints = JSON.parse(localStorage.getItem('cms_complaints'));
}

function saveStorage() {
    localStorage.setItem('cms_students', JSON.stringify(state.students));
    localStorage.setItem('cms_complaints', JSON.stringify(state.complaints));
}

// Flash Message/Toast Helper
function showToast(message, type = 'success') {
    const toastArea = document.getElementById('toast-area');
    if (!toastArea) return;
    
    const id = 'toast-' + Date.now();
    const alertHtml = `
        <div id="${id}" class="alert alert-${type} alert-dismissible fade show mb-2 shadow" role="alert">
            <i class="fa-solid ${type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info'} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    toastArea.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
            bsAlert.close();
        }
    }, 4500);
}

// Navigation & Screen Rendering
function navigate(screen) {
    state.currentScreen = screen;
    
    // Close sidebar on mobile
    document.getElementById('sidebar')?.classList.remove('open');
    
    // Hide all main containers
    document.getElementById('auth-wrapper').classList.add('d-none');
    document.getElementById('layout-wrapper').classList.add('d-none');
    
    // Hide all content areas
    const contentAreas = ['student-dashboard-area', 'submit-complaint-area', 'my-complaints-area', 'admin-dashboard-area'];
    contentAreas.forEach(area => document.getElementById(area)?.classList.add('d-none'));

    // Reset navbar active links
    document.querySelectorAll('.nav-link-item').forEach(link => link.classList.remove('active'));

    if (screen === 'login' || screen === 'register') {
        document.getElementById('auth-wrapper').classList.remove('d-none');
        document.getElementById('auth-login-card').classList.toggle('d-none', screen !== 'login');
        document.getElementById('auth-register-card').classList.toggle('d-none', screen !== 'register');
        
        // Show proper mode
        const titleEl = document.getElementById('login-title');
        const subtitleEl = document.getElementById('login-subtitle');
        const toggleBtnEl = document.getElementById('login-toggle-btn');
        const loginForm = document.getElementById('loginForm');
        
        if (state.adminMode) {
            titleEl.textContent = 'Admin Portal';
            subtitleEl.textContent = 'Sign in with your admin credentials';
            toggleBtnEl.innerHTML = '<i class="fa-solid fa-graduation-cap me-1"></i> Student Login →';
            loginForm.querySelector('.student-only').classList.add('d-none');
            loginForm.querySelector('.admin-only').classList.remove('d-none');
        } else {
            titleEl.textContent = 'Student Login';
            subtitleEl.textContent = 'Sign in to manage your complaints';
            toggleBtnEl.innerHTML = '<i class="fa-solid fa-user-shield me-1"></i> Admin Login →';
            loginForm.querySelector('.student-only').classList.remove('d-none');
            loginForm.querySelector('.admin-only').classList.add('d-none');
        }
    } else {
        // Logged In Views
        document.getElementById('layout-wrapper').classList.remove('d-none');
        
        // Set User Badge info
        document.getElementById('user-avatar-text').textContent = state.currentUser.name[0].toUpperCase();
        document.getElementById('user-display-name').textContent = state.currentUser.name;

        // Toggle Sidebar view
        const isStudent = state.currentUser.role === 'student';
        document.getElementById('sidebar-brand-title').textContent = 'Complaint MS';
        document.getElementById('sidebar-brand-sub').textContent = isStudent ? 'Student Portal' : 'Admin Dashboard';
        document.getElementById('student-nav-links').classList.toggle('d-none', !isStudent);
        document.getElementById('admin-nav-links').classList.toggle('d-none', isStudent);

        // Show exact screen
        if (screen === 'dashboard') {
            document.getElementById('student-dashboard-area').classList.remove('d-none');
            document.getElementById('nav-dash').classList.add('active');
            document.getElementById('top-nav-title').innerHTML = '<i class="fa-solid fa-gauge-high me-2" style="color:var(--primary-light);"></i>Dashboard';
            document.getElementById('welcome-name').textContent = state.currentUser.name;
            updateStudentDashboard();
        } else if (screen === 'submit') {
            document.getElementById('submit-complaint-area').classList.remove('d-none');
            document.getElementById('nav-submit').classList.add('active');
            document.getElementById('top-nav-title').innerHTML = '<i class="fa-solid fa-plus-circle me-2" style="color:var(--primary-light);"></i>Submit a Complaint';
            resetComplaintForm();
        } else if (screen === 'my-complaints') {
            document.getElementById('my-complaints-area').classList.remove('d-none');
            document.getElementById('nav-view').classList.add('active');
            document.getElementById('top-nav-title').innerHTML = '<i class="fa-solid fa-list-check me-2" style="color:var(--primary-light);"></i>My Complaints';
            renderMyComplaints();
        } else if (screen === 'admin-dashboard') {
            document.getElementById('admin-dashboard-area').classList.remove('d-none');
            document.getElementById('nav-admin-dash').classList.add('active');
            document.getElementById('top-nav-title').innerHTML = '<i class="fa-solid fa-user-shield me-2" style="color:var(--primary-light);"></i>Admin Dashboard';
            updateAdminDashboard();
        }
    }
}

// Student Dashboard update
function updateStudentDashboard() {
    const sid = state.currentUser.id;
    const userComplaints = state.complaints.filter(c => c.student_id === sid);
    
    const total = userComplaints.length;
    const pending = userComplaints.filter(c => c.status === 'Pending').length;
    const inProgress = userComplaints.filter(c => c.status === 'In Progress').length;
    const resolved = userComplaints.filter(c => c.status === 'Resolved').length;

    document.getElementById('student-stat-total').textContent = total;
    document.getElementById('student-stat-pending').textContent = pending;
    document.getElementById('student-stat-inprogress').textContent = inProgress;
    document.getElementById('student-stat-resolved').textContent = resolved;

    // Recent 5 complaints table
    const sorted = [...userComplaints].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    const tbody = document.getElementById('student-recent-tbody');
    const container = document.getElementById('student-recent-table-container');
    const emptyState = document.getElementById('student-recent-empty');

    if (sorted.length > 0) {
        container.classList.remove('d-none');
        emptyState.classList.add('d-none');
        tbody.innerHTML = sorted.map((c, index) => {
            const dateFormatted = new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <tr>
                    <td style="color:var(--text-muted);">#${c.complaint_id}</td>
                    <td><span style="font-size:0.8rem;">${c.category}</span></td>
                    <td style="max-width:200px;"><span class="text-truncate d-block" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span></td>
                    <td><span class="badge-status ${getPriorityClass(c.priority)}">${c.priority}</span></td>
                    <td>
                        <span class="badge-status ${getStatusClass(c.status)}">
                            <i class="fa-solid ${getStatusIcon(c.status)}"></i> ${c.status}
                        </span>
                    </td>
                    <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">${dateFormatted}</td>
                </tr>
            `;
        }).join('');
    } else {
        container.classList.add('d-none');
        emptyState.classList.remove('d-none');
    }
}

// Render student's full complaints list
function renderMyComplaints() {
    const sid = state.currentUser.id;
    const userComplaints = state.complaints.filter(c => c.student_id === sid);
    const container = document.getElementById('my-complaints-table-container');
    const emptyState = document.getElementById('my-complaints-empty');
    const tbody = document.getElementById('my-complaints-tbody');

    if (userComplaints.length > 0) {
        container.classList.remove('d-none');
        emptyState.classList.add('d-none');
        
        tbody.innerHTML = userComplaints.map(c => {
            const dateFormatted = new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const isPending = c.status === 'Pending';
            
            return `
                <tr>
                    <td style="color:var(--text-muted);font-size:0.8rem;">#${c.complaint_id}</td>
                    <td>
                        <span style="font-size:0.8rem;display:flex;align-items:center;gap:0.4rem;">
                            <i class="fa-solid ${getCategoryIcon(c.category)}" style="color:var(--primary-light);width:14px;"></i>
                            ${c.category}
                        </span>
                    </td>
                    <td style="max-width:220px;"><span class="text-truncate d-block" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span></td>
                    <td><span class="badge-status ${getPriorityClass(c.priority)}">${c.priority}</span></td>
                    <td>
                        <span class="badge-status ${getStatusClass(c.status)}">
                            <i class="fa-solid ${getStatusIcon(c.status)}"></i> ${c.status}
                        </span>
                    </td>
                    <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">${dateFormatted}</td>
                    <td>
                        <div class="d-flex gap-1 flex-wrap">
                            <button class="btn-action btn-update" onclick="viewDetails(${c.complaint_id})">
                                <i class="fa-solid fa-eye"></i> View
                            </button>
                            ${isPending ? `
                                <button class="btn-action btn-update" onclick="openEditModal(${c.complaint_id})">
                                    <i class="fa-solid fa-pen-to-square"></i> Edit
                                </button>
                                <button class="btn-action btn-delete" onclick="openDeleteModal(${c.complaint_id})">
                                    <i class="fa-solid fa-trash"></i> Delete
                                </button>
                            ` : `
                                <button class="btn-action btn-update opacity-50" style="cursor:not-allowed;" title="Locked" disabled>
                                    <i class="fa-solid fa-lock"></i> Edit
                                </button>
                                <button class="btn-action btn-delete opacity-50" style="cursor:not-allowed;" title="Locked" disabled>
                                    <i class="fa-solid fa-lock"></i> Delete
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        container.classList.add('d-none');
        emptyState.classList.remove('d-none');
    }
}

// Render admin's complaints with filters
function updateAdminDashboard() {
    const complaints = state.complaints;
    
    // Admin Stat cards
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'Pending').length;
    const inProgress = complaints.filter(c => c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;

    document.getElementById('admin-stat-total').textContent = total;
    document.getElementById('admin-stat-pending').textContent = pending;
    document.getElementById('admin-stat-inprogress').textContent = inProgress;
    document.getElementById('admin-stat-resolved').textContent = resolved;

    // Category Breakdown counts
    const breakdownList = document.getElementById('admin-category-breakdown');
    const categoryCounts = {};
    CATEGORIES.forEach(cat => categoryCounts[cat] = 0);
    complaints.forEach(c => {
        if (categoryCounts[c.category] !== undefined) {
            categoryCounts[c.category]++;
        } else {
            categoryCounts[c.category] = 1;
        }
    });

    breakdownList.innerHTML = Object.entries(categoryCounts).map(([cat, count]) => `
        <li class="d-flex justify-content-between align-items-center mb-2" style="font-size: 0.85rem;">
            <span><i class="fa-solid ${getCategoryIcon(cat)} me-2" style="color:var(--primary-light);"></i>${cat}</span>
            <span class="badge bg-secondary rounded-pill" style="background:var(--border) !important;">${count}</span>
        </li>
    `).join('');

    renderAdminTable();
}

function renderAdminTable() {
    const searchVal = document.getElementById('admin-search').value.toLowerCase().trim();
    const catVal = document.getElementById('admin-filter-category').value;
    const statusVal = document.getElementById('admin-filter-status').value;

    let filtered = [...state.complaints];

    if (searchVal) {
        filtered = filtered.filter(c => 
            c.title.toLowerCase().includes(searchVal) || 
            c.description.toLowerCase().includes(searchVal) ||
            c.student_name.toLowerCase().includes(searchVal)
        );
    }

    if (catVal) {
        filtered = filtered.filter(c => c.category === catVal);
    }

    if (statusVal) {
        filtered = filtered.filter(c => c.status === statusVal);
    }

    // Sort by date newest first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('admin-tbody');
    const container = document.getElementById('admin-table-container');
    const emptyState = document.getElementById('admin-empty-state');

    if (filtered.length > 0) {
        container.classList.remove('d-none');
        emptyState.classList.add('d-none');

        tbody.innerHTML = filtered.map(c => {
            const dateFormatted = new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <tr>
                    <td style="color:var(--text-muted);font-size:0.8rem;">#${c.complaint_id}</td>
                    <td>
                        <div>
                            <span class="fw-bold d-block">${escapeHtml(c.student_name)}</span>
                            <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(c.student_email)}</span>
                        </div>
                    </td>
                    <td>
                        <span style="font-size:0.8rem;display:flex;align-items:center;gap:0.4rem;">
                            <i class="fa-solid ${getCategoryIcon(c.category)}" style="color:var(--primary-light);"></i>
                            ${c.category}
                        </span>
                    </td>
                    <td style="max-width:180px;"><span class="text-truncate d-block" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span></td>
                    <td><span class="badge-status ${getPriorityClass(c.priority)}">${c.priority}</span></td>
                    <td>
                        <span class="badge-status ${getStatusClass(c.status)}">
                            <i class="fa-solid ${getStatusIcon(c.status)}"></i> ${c.status}
                        </span>
                    </td>
                    <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">${dateFormatted}</td>
                    <td>
                        <div class="d-flex gap-1 flex-wrap">
                            <button class="btn-action btn-update" onclick="viewDetails(${c.complaint_id})">
                                <i class="fa-solid fa-eye"></i> View
                            </button>
                            <button class="btn-action btn-update" onclick="openAdminUpdateModal(${c.complaint_id})">
                                <i class="fa-solid fa-pen-to-square"></i> Status
                            </button>
                            <button class="btn-action btn-delete" onclick="openAdminDeleteModal(${c.complaint_id})">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        container.classList.add('d-none');
        emptyState.classList.remove('d-none');
    }
}

// View Details Modal
function viewDetails(id) {
    const c = state.complaints.find(comp => comp.complaint_id === id);
    if (!c) return;

    document.getElementById('md-id').textContent = '#' + c.complaint_id;
    document.getElementById('md-title').textContent = c.title;
    document.getElementById('md-category').textContent = c.category;
    document.getElementById('md-description').textContent = c.description;

    const dateFormatted = new Date(c.created_at).toLocaleDateString('en-GB', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });
    document.getElementById('md-date').textContent = dateFormatted;

    document.getElementById('md-priority').innerHTML = `
        <span class="badge-status ${getPriorityClass(c.priority)}">${c.priority}</span>
    `;

    document.getElementById('md-status').innerHTML = `
        <span class="badge-status ${getStatusClass(c.status)}">
            <i class="fa-solid ${getStatusIcon(c.status)}"></i> ${c.status}
        </span>
    `;

    const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    detailModal.show();
}

// Edit Modal Student
let currentEditingId = null;
function openEditModal(id) {
    const c = state.complaints.find(comp => comp.complaint_id === id);
    if (!c || c.status !== 'Pending') return;

    currentEditingId = id;
    document.getElementById('edit-title').value = c.title;
    document.getElementById('edit-category').value = c.category;
    document.getElementById('edit-description').value = c.description;

    document.getElementById('edit-titleCount').textContent = c.title.length;
    document.getElementById('edit-descCount').textContent = c.description.length;

    const radioBtn = document.getElementById(`edit-p-${c.priority.toLowerCase()}`);
    if (radioBtn) radioBtn.checked = true;

    const editModal = new bootstrap.Modal(document.getElementById('studentEditModal'));
    editModal.show();
}

// Delete Modal Student
let currentDeletingId = null;
function openDeleteModal(id) {
    const c = state.complaints.find(comp => comp.complaint_id === id);
    if (!c || c.status !== 'Pending') return;

    currentDeletingId = id;
    document.getElementById('sd-title').textContent = c.title;

    const delModal = new bootstrap.Modal(document.getElementById('studentDeleteModal'));
    delModal.show();
}

// Admin Update Status Modal
let currentAdminUpdateId = null;
function openAdminUpdateModal(id) {
    const c = state.complaints.find(comp => comp.complaint_id === id);
    if (!c) return;

    currentAdminUpdateId = id;
    document.getElementById('admin-update-status').value = c.status;

    const updModal = new bootstrap.Modal(document.getElementById('adminUpdateModal'));
    updModal.show();
}

// Admin Delete Modal
let currentAdminDeleteId = null;
function openAdminDeleteModal(id) {
    const c = state.complaints.find(comp => comp.complaint_id === id);
    if (!c) return;

    currentAdminDeleteId = id;
    document.getElementById('ad-title').textContent = c.title;

    const delModal = new bootstrap.Modal(document.getElementById('adminDeleteModal'));
    delModal.show();
}

// Reset form values
function resetComplaintForm() {
    const form = document.getElementById('complaintForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('titleCount').textContent = '0';
    document.getElementById('descCount').textContent = '0';
}

// Helper Class Resolvers
function getPriorityClass(p) {
    return p === 'High' ? 'badge-high' : p === 'Medium' ? 'badge-medium' : 'badge-low';
}

function getStatusClass(s) {
    return s === 'Pending' ? 'badge-pending' : s === 'In Progress' ? 'badge-in-progress' : 'badge-resolved';
}

function getStatusIcon(s) {
    return s === 'Pending' ? 'fa-clock' : s === 'In Progress' ? 'fa-spinner fa-spin' : 'fa-check';
}

function getCategoryIcon(cat) {
    if (cat.includes('WiFi')) return 'fa-wifi';
    if (cat.includes('Electric')) return 'fa-bolt';
    if (cat.includes('Water')) return 'fa-droplet';
    if (cat.includes('Classroom')) return 'fa-chalkboard';
    if (cat.includes('Hostel')) return 'fa-building';
    return 'fa-circle-question';
}

// Escape HTML utility to prevent XSS in LocalStorage injection
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Document Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initStorage();

    // Toggle Admin/Student login page mode
    document.getElementById('login-toggle-btn').addEventListener('click', () => {
        state.adminMode = !state.adminMode;
        navigate('login');
    });

    // Toggle password eye icon
    document.getElementById('togglePw').addEventListener('click', () => {
        const pw = document.getElementById('password');
        const ic = document.getElementById('eyeIcon');
        if (pw.type === 'password') {
            pw.type = 'text';
            ic.className = 'fa-solid fa-eye-slash';
        } else {
            pw.type = 'password';
            ic.className = 'fa-solid fa-eye';
        }
    });

    // Mobile sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Character counters for submission form
    const titleInput = document.getElementById('title');
    const descInput = document.getElementById('description');
    titleInput?.addEventListener('input', () => {
        document.getElementById('titleCount').textContent = titleInput.value.length;
    });
    descInput?.addEventListener('input', () => {
        document.getElementById('descCount').textContent = descInput.value.length;
    });

    // Character counters for edit modal
    const editTitle = document.getElementById('edit-title');
    const editDesc = document.getElementById('edit-description');
    editTitle?.addEventListener('input', () => {
        document.getElementById('edit-titleCount').textContent = editTitle.value.length;
    });
    editDesc?.addEventListener('input', () => {
        document.getElementById('edit-descCount').textContent = editDesc.value.length;
    });

    // --- FORM SUBMISSIONS ---

    // Login Form Submit
    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        if (state.adminMode) {
            const username = document.getElementById('username').value.trim();
            const pw = document.getElementById('password').value.trim();
            
            if (username === 'admin' && pw === 'admin123') {
                state.currentUser = { id: 0, name: 'Admin Account', email: 'admin@college.edu', role: 'admin' };
                showToast("Admin access granted! Welcome back.", "success");
                navigate('admin-dashboard');
                // Clear fields
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
            } else {
                showToast("Invalid admin credentials.", "danger");
            }
        } else {
            const email = document.getElementById('email').value.trim().toLowerCase();
            const pw = document.getElementById('password').value.trim();
            
            const student = state.students.find(s => s.email === email && s.password === pw);
            if (student) {
                state.currentUser = { id: student.student_id, name: student.name, email: student.email, role: 'student' };
                showToast(`Welcome back, ${student.name}!`, "success");
                navigate('dashboard');
                // Clear fields
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
            } else {
                showToast("Invalid email or password.", "danger");
            }
        }
    });

    // Register Form Submit
    document.getElementById('registerForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const phone = document.getElementById('reg-phone').value.trim();
        const pw = document.getElementById('reg-password').value.trim();
        const confirm = document.getElementById('reg-confirm').value.trim();

        if (!name || !email || !phone || !pw || !confirm) {
            showToast("All fields are required.", "danger");
            return;
        }

        if (pw !== confirm) {
            showToast("Passwords do not match.", "danger");
            return;
        }

        if (pw.length < 6) {
            showToast("Password must be at least 6 characters.", "danger");
            return;
        }

        if (state.students.some(s => s.email === email)) {
            showToast("Email already registered. Please login.", "warning");
            return;
        }

        const newStudent = {
            student_id: state.students.length > 0 ? Math.max(...state.students.map(s => s.student_id)) + 1 : 1,
            name: name,
            email: email,
            phone: phone,
            password: pw
        };

        state.students.push(newStudent);
        saveStorage();
        showToast("Registration successful! Please login below.", "success");
        
        // Reset fields
        this.reset();
        state.adminMode = false;
        navigate('login');
    });

    // New Complaint Submission
    document.getElementById('complaintForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const cat = document.getElementById('category').value;
        const title = document.getElementById('title').value.trim();
        const desc = document.getElementById('description').value.trim();
        const priority = document.querySelector('input[name="priority"]:checked').value;

        if (!cat || !title || !desc) {
            this.classList.add('was-validated');
            showToast("Please fill in all required fields.", "danger");
            return;
        }

        const newComp = {
            complaint_id: state.complaints.length > 0 ? Math.max(...state.complaints.map(c => c.complaint_id)) + 1 : 101,
            student_id: state.currentUser.id,
            student_name: state.currentUser.name,
            student_email: state.currentUser.email,
            category: cat,
            title: title,
            description: desc,
            priority: priority,
            status: "Pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        state.complaints.push(newComp);
        saveStorage();
        showToast("Complaint submitted successfully!", "success");
        navigate('dashboard');
    });

    // Student Edit Form
    document.getElementById('studentEditForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const c = state.complaints.find(comp => comp.complaint_id === currentEditingId);
        if (!c || c.status !== 'Pending') return;

        const cat = document.getElementById('edit-category').value;
        const title = document.getElementById('edit-title').value.trim();
        const desc = document.getElementById('edit-description').value.trim();
        const priority = document.querySelector('input[name="priority"]:checked').value;

        if (!cat || !title || !desc) {
            showToast("All fields are required.", "danger");
            return;
        }

        c.category = cat;
        c.title = title;
        c.description = desc;
        c.priority = priority;
        c.updated_at = new Date().toISOString();

        saveStorage();
        showToast("Complaint updated successfully!", "success");
        
        bootstrap.Modal.getInstance(document.getElementById('studentEditModal')).hide();
        renderMyComplaints();
    });

    // Student Delete Form
    document.getElementById('studentDeleteForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const index = state.complaints.findIndex(comp => comp.complaint_id === currentDeletingId);
        if (index === -1) return;

        const c = state.complaints[index];
        if (c.status !== 'Pending') {
            showToast("Only pending complaints can be deleted.", "warning");
            return;
        }

        state.complaints.splice(index, 1);
        saveStorage();
        showToast("Complaint deleted successfully.", "success");

        bootstrap.Modal.getInstance(document.getElementById('studentDeleteModal')).hide();
        renderMyComplaints();
    });

    // Admin Update Status Form
    document.getElementById('adminUpdateForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const c = state.complaints.find(comp => comp.complaint_id === currentAdminUpdateId);
        if (!c) return;

        const newStatus = document.getElementById('admin-update-status').value;
        c.status = newStatus;
        c.updated_at = new Date().toISOString();

        saveStorage();
        showToast("Complaint status updated successfully.", "success");

        bootstrap.Modal.getInstance(document.getElementById('adminUpdateModal')).hide();
        updateAdminDashboard();
    });

    // Admin Delete Form
    document.getElementById('adminDeleteForm').addEventListener('submit', function (e) {
        e.preventDefault();
        
        const index = state.complaints.findIndex(comp => comp.complaint_id === currentAdminDeleteId);
        if (index === -1) return;

        state.complaints.splice(index, 1);
        saveStorage();
        showToast("Complaint deleted successfully.", "success");

        bootstrap.Modal.getInstance(document.getElementById('adminDeleteModal')).hide();
        updateAdminDashboard();
    });

    // Admin Live Filters
    document.getElementById('admin-search').addEventListener('input', renderAdminTable);
    document.getElementById('admin-filter-category').addEventListener('change', renderAdminTable);
    document.getElementById('admin-filter-status').addEventListener('change', renderAdminTable);

    // Initial navigation
    navigate('login');
});

// Logout Helper
function logout() {
    state.currentUser = null;
    showToast("Logged out successfully.", "info");
    navigate('login');
}
