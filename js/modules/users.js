import { db } from '../firebase-config.js';
import { collection, addDoc, doc, updateDoc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const usersTableBody = document.getElementById('users-table-body');
const userForm = document.getElementById('user-form');
const btnSaveUser = document.getElementById('btn-save-user');

export async function getUserRole(email) {
    try {
        const q = query(collection(db, "roles"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data().role;
        }
    } catch(e) {
        console.error("Error getting role", e);
    }
    // Default to admin if no roles defined at all? No, let's default to Admin if the database is literally empty (first time setup).
    try {
        const check = await getDocs(collection(db, "roles"));
        if (check.empty) {
            // First user gets Admin automatically
            await addDoc(collection(db, "roles"), {
            createdAt: new Date().toISOString(), email: email, role: "Admin", nombre: "Admin", apellido: "Principal" });
            return "Admin";
        }
    } catch(e) {}
    
    return "Cajero"; // Default fallback
}
export async function getUserData(email) {
    try {
        const q = query(collection(db, "roles"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data();
        }
    } catch(e) {}
    return null;
}

export async function initUsersView() {
    if (!usersTableBody) return;
    setupUsers();
    await loadUsers();
}

async function loadUsers() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="3" class="text-center">
                <div class="spinner-border text-primary my-3" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </td>
        </tr>
    `;
    try {
        const querySnapshot = await getDocs(collection(db, "roles"));
        usersTableBody.innerHTML = '';
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const tr = document.createElement('tr');
            
            const fullName = `${data.nombre || ''} ${data.apellido || ''}`.trim() || 'Sin Nombre';
            const ci = data.ci || '-';
            
            tr.innerHTML = `
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
            `;
            usersTableBody.appendChild(tr);
        });
    } catch (e) {
        usersTableBody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar roles.</td></tr>';
    }
}

function setupUsers() {
    btnSaveUser.addEventListener('click', async () => {
        if (btnSaveUser.disabled) return;
        btnSaveUser.disabled = true;
        const originalText = btnSaveUser.innerHTML;
        btnSaveUser.innerHTML = '<span class="spinner-border spinner-border-sm"></span>...';

        const email = document.getElementById('user-email').value;
        const role = document.getElementById('user-role').value;
        const nombre = document.getElementById('user-nombre').value;
        const apellido = document.getElementById('user-apellido').value;
        const ci = document.getElementById('user-ci').value;
        const sexo = document.getElementById('user-sexo').value;
        const password = document.getElementById('user-password').value;

        if (!email || !nombre || !apellido || !ci || !sexo) {
            Swal.fire('Atención', 'Todos los campos básicos son requeridos', 'warning');
            btnSaveUser.disabled = false;
            btnSaveUser.innerHTML = originalText;
            return;
        }

        try {
            // If there's a password, we create the auth user
            if (password) {
                const { createUserWithEmailAndPassword, getAuth } = await import("https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js");
                const secondAuth = getAuth(); 
                // Note: using the same auth instance will log the admin out.
                // We'll let Firebase do it or warn the user.
                try {
                    await createUserWithEmailAndPassword(secondAuth, email, password);
                    // We might get logged out here, but we continue saving the role
                } catch(err) {
                    Swal.fire('Error Auth', err.message, 'error');
                    btnSaveUser.disabled = false;
                    btnSaveUser.innerHTML = originalText;
                    return;
                }
            }

            const userId = document.getElementById('user-id').value;
            const userData = { email, role, nombre, apellido, ci, sexo };
            
            if (userId) {
                // Update by ID
                const docRef = doc(db, "roles", userId);
                await updateDoc(docRef, userData);
            } else {
                // Check if email already exists before inserting
                const q = query(collection(db, "roles"), where("email", "==", email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    Swal.fire('Atención', 'Ya existe un usuario con este correo', 'warning');
                    btnSaveUser.disabled = false;
                    btnSaveUser.innerHTML = originalText;
                    return;
                }
                // Insert
                await addDoc(collection(db, "roles"), userData);
            }
            
            const modalEl = document.getElementById('userModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            userForm.reset();
            
            await loadUsers();
            Swal.fire('Â¡Guardado!', 'El rol se ha guardado correctamente.', 'success');
        } catch(e) {
            Swal.fire('Error', 'Error: ' + e.message, 'error');
        } finally {
            btnSaveUser.disabled = false;
            btnSaveUser.innerHTML = originalText;
        }
    });

    usersTableBody.addEventListener('click', async (e) => {
        const btnDelete = e.target.closest('.btn-delete-user');
        const btnEdit = e.target.closest('.btn-edit-user');
        
        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const userData = JSON.parse(btnEdit.dataset.user.replace(/&apos;/g, "'"));
            
            document.getElementById('user-id').value = id;
            document.getElementById('user-email').value = userData.email || '';
            document.getElementById('user-role').value = userData.role || 'Cajero';
            document.getElementById('user-nombre').value = userData.nombre || '';
            document.getElementById('user-apellido').value = userData.apellido || '';
            document.getElementById('user-ci').value = userData.ci || '';
            document.getElementById('user-sexo').value = userData.sexo || '';
            document.getElementById('user-password').value = '';
            
            document.querySelector('.modal-title').textContent = 'Editar Usuario';
            
            const modal = new bootstrap.Modal(document.getElementById('userModal'));
            modal.show();
            return;
        }

        if (btnDelete) {
            const id = btnDelete.dataset.id;
            Swal.fire({
                title: 'Â¿Estás seguro?',
                text: "Esta acción no se puede deshacer.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await deleteDoc(doc(db, "roles", id));
                        await loadUsers();
                        Swal.fire('Â¡Eliminado!', 'El rol ha sido eliminado.', 'success');
                    } catch(err) {
                        Swal.fire('Error', 'Error al eliminar: ' + err.message, 'error');
                    }
                }
            });
        }
    });

    // Reset modal when opened manually (not via Edit)
    const userModalEl = document.getElementById('userModal');
    userModalEl.addEventListener('show.bs.modal', function (event) {
        // If the modal was triggered by the "Registrar Rol" button
        if (event.relatedTarget && event.relatedTarget.hasAttribute('data-bs-target')) {
            userForm.reset();
            document.getElementById('user-id').value = '';
            document.querySelector('.modal-title').textContent = 'Registrar Nuevo Usuario';
        }
    });
}

