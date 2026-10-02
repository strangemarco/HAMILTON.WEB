import { supabase } from '../supabase-config.js';


const usersTableBody = document.getElementById('users-table-body');
const userForm = document.getElementById('user-form');
const btnSaveUser = document.getElementById('btn-save-user');

export async function getUserRole(email) {
    try {
        const { data, error } = await supabase.from('users').select('role').eq('email', email).maybeSingle();
        if (data && data.role) return data.role;
    } catch(e) { console.error("Error getting role", e); }
    return "Cajero";
}
export async function getUserData(email) {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
        if (data) return data;
    } catch(e) {}
    return null;
}

export async function initUsersView() {
    if (!usersTableBody) return;
    setupUsers();
    await loadUsers();
}

async function loadUsers() {
    usersTableBody.innerHTML = <tr><td colspan="5" class="text-center"><div class="spinner-border text-primary my-3"></div></td></tr>;
    try {
        const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        usersTableBody.innerHTML = '';
        users.forEach((data) => {
            const id = data.id;
            const tr = document.createElement('tr');
            const fullName = ${data.nombre || ''} .trim() || 'Sin Nombre';
            const ci = data.ci || '-';
            
            tr.innerHTML = 
                <td class="fw-bold">${fullName}</td>
                <td>${ci}</td>
                <td class="text-muted">${data.email}</td>
                <td><span class="badge ${data.role === 'Admin' ? 'bg-primary' : 'bg-secondary'}">${data.role}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary btn-edit-user me-1" data-id="${id}" data-user='${JSON.stringify(data).replace(/'/g, "&apos;")}'>
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${id}"><i class="bi bi-trash"></i></button>
                </td>
            ;
            usersTableBody.appendChild(tr);
        });
    } catch (e) {
        usersTableBody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Error al cargar roles.</td></tr>';
    }
}

function setupUsers() {
    btnSaveUser.addEventListener('click', async () => {
        const id = document.getElementById('user-id').value;
        const nombre = document.getElementById('user-nombre').value;
        const apellido = document.getElementById('user-apellido').value;
        const ci = document.getElementById('user-ci').value;
        const email = document.getElementById('user-email').value;
        const role = document.getElementById('user-role').value;
        
        if (!email || !nombre) {
            Swal.fire('Error', 'Nombre y Email son obligatorios', 'error');
            return;
        }

        try {
            btnSaveUser.disabled = true;
            btnSaveUser.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

            if (id) {
                // Update
                const { error } = await supabase.from('users').update({
                    nombre, apellido, ci, email, role
                }).eq('id', id);
                if (error) throw error;
                Swal.fire('Éxito', 'Usuario actualizado', 'success');
            } else {
                // Not supported from client without Edge function since we need to create auth user
                Swal.fire('Atención', 'Para crear nuevos usuarios, debes crearlos primero en la consola de Supabase Auth.', 'warning');
            }
            
            const modalEl = document.getElementById('userModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            userForm.reset();
            document.getElementById('user-id').value = '';
            
            await loadUsers();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        } finally {
            btnSaveUser.disabled = false;
            btnSaveUser.innerHTML = '<i class="bi bi-save me-1"></i> Guardar Usuario';
        }
    });

    usersTableBody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-user');
        if (btnEdit) {
            const data = JSON.parse(btnEdit.dataset.user);
            document.getElementById('user-id').value = data.id;
            document.getElementById('user-nombre').value = data.nombre || '';
            document.getElementById('user-apellido').value = data.apellido || '';
            document.getElementById('user-ci').value = data.ci || '';
            document.getElementById('user-email').value = data.email || '';
            document.getElementById('user-role').value = data.role || 'Empleado';
            
            const modal = new bootstrap.Modal(document.getElementById('userModal'));
            modal.show();
        }
        
        const btnDelete = e.target.closest('.btn-delete-user');
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            const res = await Swal.fire({
                title: '¿Eliminar usuario?',
                text: "No podrás revertir esto.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar'
            });
            
            if (res.isConfirmed) {
                try {
                    const { error } = await supabase.from('users').delete().eq('id', id);
                    if (error) throw error;
                    Swal.fire('Eliminado', 'Usuario borrado', 'success');
                    await loadUsers();
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                }
            }
        }
    });
}



