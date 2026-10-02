import { supabase } from '../supabase-config.js';
import { updateNavbarUser } from './ui.js';
import { initInventory } from './inventory.js';
import { initSalesView } from './sales.js';
import { getUserRole, initUsersView } from './users.js';
import { initDashboardView } from './dashboard.js';
import { initLogsView } from './logs.js';
import { initCajaView } from './caja.js';

export function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const btnLogout = document.getElementById('btn-logout');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = loginForm.querySelector('button[type="submit"]');
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Ingresando...';
                
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Redirect is handled by onAuthStateChange
            } catch (error) {
                Swal.fire('Error', 'Error: ' + error.message, 'error');
                btn.disabled = false;
                btn.innerHTML = 'Ingresar';
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        const path = window.location.pathname;
        const isLoginPage = path.endsWith('index.html') || path.endsWith('/');
        const isUsersPage = path.endsWith('users.html');
        const isDashboardPage = path.endsWith('dashboard.html');

        const user = session?.user;

        if (user) {
            // Determine Role and fetch full user data
            const { getUserRole, getUserData } = await import('./users.js');
            const role = await getUserRole(user.email);
            const userData = await getUserData(user.email) || {};
            
            localStorage.setItem('hamilton_user', JSON.stringify({
                email: user.email,
                role: role,
                nombre: userData.nombre || '',
                apellido: userData.apellido || '',
                ci: userData.ci || ''
            }));
            
            if (isLoginPage) {
                if (role === 'Admin') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'inventory.html';
                }
            } else {
                // RBAC Protection
                if ((isUsersPage || isDashboardPage || path.endsWith('logs.html')) && role !== 'Admin') {
                    Swal.fire('Acceso denegado', 'Se requiere rol de Administrador para ver esta página.', 'error').then(() => {
                        window.location.href = 'inventory.html';
                    });
                    return;
                }

                updateNavbarUser(user.email, role);
                document.body.classList.remove('role-admin', 'role-cajero');
                document.body.classList.add(role === 'Admin' ? 'role-admin' : 'role-cajero');

                // Initialize Views
                initInventory();
                initSalesView();
                initUsersView();
                initDashboardView();
                initLogsView();
                initCajaView();

                // Show body now that auth is resolved
                document.body.classList.remove('loading-auth');
            }
        } else {
            if (!isLoginPage && event === 'SIGNED_OUT') {
                window.location.href = 'index.html';
            } else if (!isLoginPage) {
                 window.location.href = 'index.html';
            } else {
                document.body.classList.remove('loading-auth');
            }
        }
    });
}
