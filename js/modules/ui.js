import { supabase } from '../supabase-config.js';

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

// --- Notifications Bell ---
export async function initNotifications() {
    const themeToggleWrapper = document.querySelector('.form-check.form-switch');
    if (!themeToggleWrapper) return;
    
    // Inject Bell
    if (!document.getElementById('notification-bell-container')) {
        const bellHtml = `
            <div id="notification-bell-container" class="position-relative me-4" style="cursor: pointer; margin-top: 5px;" data-bs-toggle="modal" data-bs-target="#lowStockModal">
                <i class="bi bi-bell-fill fs-5 text-secondary"></i>
                <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" id="notification-badge" style="font-size: 0.65rem;">
                    0
                </span>
            </div>
        `;
        
        const parent = themeToggleWrapper.parentNode;
        if (!parent.classList.contains('topbar-actions')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'd-flex align-items-center topbar-actions';
            parent.insertBefore(wrapper, themeToggleWrapper);
            wrapper.insertAdjacentHTML('beforeend', bellHtml);
            
            // Remove margin-bottom from theme toggle if any, to align perfectly
            themeToggleWrapper.classList.remove('mb-0');
            themeToggleWrapper.style.margin = '0';
            
            wrapper.appendChild(themeToggleWrapper);
        }
    }

    // Inject Modal
    if (!document.getElementById('lowStockModal')) {
        const modalHtml = `
            <div class="modal fade" id="lowStockModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>Alertas de Stock Bajo</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div class="list-group list-group-flush" id="low-stock-list">
                                <div class="p-3 text-center text-muted">Cargando alertas...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    await checkLowStockNotifications();
}

export async function checkLowStockNotifications() {
    try {
        const { data: lowStockProducts, error } = await supabase
            .from('products')
            .select('codigo, descripcion, stock')
            .eq('estado', 'activos')
            .lte('stock', 5)
            .order('stock', { ascending: true });
            
        if (error) throw error;
        
        const badge = document.getElementById('notification-badge');
        const list = document.getElementById('low-stock-list');
        const bellIcon = document.querySelector('#notification-bell-container i');
        
        if (badge && list) {
            if (lowStockProducts && lowStockProducts.length > 0) {
                badge.textContent = lowStockProducts.length > 99 ? '99+' : lowStockProducts.length;
                badge.classList.remove('d-none');
                if (bellIcon) bellIcon.classList.replace('text-secondary', 'text-danger');
                
                list.innerHTML = '';
                lowStockProducts.forEach(p => {
                    list.innerHTML += `
                        <a href="inventory.html?search=${encodeURIComponent(p.codigo)}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center text-decoration-none">
                            <div>
                                <h6 class="mb-0 text-dark">${p.codigo}</h6>
                                <small class="text-muted">${p.descripcion}</small>
                            </div>
                            <span class="badge bg-danger rounded-pill border border-dark">Stock: ${p.stock}</span>
                        </a>
                    `;
                });
            } else {
                badge.classList.add('d-none');
                if (bellIcon) bellIcon.classList.replace('text-danger', 'text-secondary');
                list.innerHTML = '<div class="p-3 text-center text-muted">Todo en orden. No hay productos con stock bajo.</div>';
            }
        }
    } catch(e) {
        console.error('Error fetching low stock:', e);
    }
}

// Automatically init notifications when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initNotifications, 500); // Small delay to let other UI elements load
});
