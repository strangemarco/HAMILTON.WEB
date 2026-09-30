export function showLoading() {
    const el = document.getElementById('loading-indicator');
    if (el) el.classList.remove('d-none');
}

export function hideLoading() {
    const el = document.getElementById('loading-indicator');
    if (el) el.classList.add('d-none');
}

export function updateNavbarUser(username, role) {
    const currentUserLabel = document.getElementById('current-user');
    const currentRoleLabel = document.getElementById('current-role');
    const navItemUsers = document.getElementById('nav-item-users');
    const navItemDashboard = document.getElementById('nav-item-dashboard');
    const navHeaderPrincipal = document.getElementById('nav-header-principal');
    const navHeaderAdmin = document.getElementById('nav-header-admin');

    if (currentUserLabel) currentUserLabel.textContent = username;
    if (currentRoleLabel) currentRoleLabel.textContent = role;

    if (role === 'Admin') {
        if (navItemUsers) navItemUsers.classList.remove('d-none');
        if (navItemDashboard) navItemDashboard.classList.remove('d-none');
        if (navHeaderPrincipal) navHeaderPrincipal.classList.remove('d-none');
        if (navHeaderAdmin) navHeaderAdmin.classList.remove('d-none');
    } else {
        if (navItemUsers) navItemUsers.classList.add('d-none');
        if (navItemDashboard) navItemDashboard.classList.add('d-none');
        if (navHeaderPrincipal) navHeaderPrincipal.classList.add('d-none');
        if (navHeaderAdmin) navHeaderAdmin.classList.add('d-none');
    }
}

// Sidebar Toggle
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebar = document.getElementById('sidebar');
if (btnToggleSidebar && sidebar) {
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
    });
}

// Theme Global Init
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
} else {
    document.documentElement.setAttribute('data-bs-theme', 'light');
}

// Theme Toggle Button
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    if (currentTheme === 'dark') themeToggle.checked = true;
    
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-bs-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });
}
