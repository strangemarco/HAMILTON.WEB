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

let mobileOverlay = null;

if (btnToggleSidebar && sidebar) {
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
        
        // Handle mobile overlay
        if (window.innerWidth <= 768) {
            if (sidebar.classList.contains('sidebar-collapsed')) {
                // Open overlay
                if (!mobileOverlay) {
                    mobileOverlay = document.createElement('div');
                    mobileOverlay.style.position = 'fixed';
                    mobileOverlay.style.top = '0';
                    mobileOverlay.style.left = '0';
                    mobileOverlay.style.width = '100vw';
                    mobileOverlay.style.height = '100vh';
                    mobileOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    mobileOverlay.style.zIndex = '1040';
                    mobileOverlay.style.transition = 'opacity 0.3s ease';
                    document.body.appendChild(mobileOverlay);
                    
                    mobileOverlay.addEventListener('click', () => {
                        sidebar.classList.remove('sidebar-collapsed');
                        mobileOverlay.style.opacity = '0';
                        setTimeout(() => {
                            if(mobileOverlay) mobileOverlay.remove();
                            mobileOverlay = null;
                        }, 300);
                    });
                }
            } else {
                // Close overlay
                if (mobileOverlay) {
                    mobileOverlay.style.opacity = '0';
                    setTimeout(() => {
                        if(mobileOverlay) mobileOverlay.remove();
                        mobileOverlay = null;
                    }, 300);
                }
            }
        }
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

// --- Table Responsive Cards Data-Labels Injector ---
function applyTableDataLabels() {
    document.querySelectorAll('table').forEach(table => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach(tr => {
            Array.from(tr.querySelectorAll('td')).forEach((td, index) => {
                if (headers[index] && !td.hasAttribute('data-label')) {
                    td.setAttribute('data-label', headers[index]);
                }
            });
        });
    });
}
const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldUpdate = true;
            break;
        }
    }
    if (shouldUpdate) applyTableDataLabels();
});
observer.observe(document.body, { childList: true, subtree: true });
applyTableDataLabels();
