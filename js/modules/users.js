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
            await addDoc(collection(db, "roles"), { email: email, role: "Admin" });
            return "Admin";
        }
    } catch(e) {}
    
    return "Cajero"; // Default fallback
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
            
            tr.innerHTML = `
                <td class="fw-bold">${data.email}</td>
                <td><span class="badge ${data.role === 'Admin' ? 'bg-primary' : 'bg-secondary'}">${data.role}</span></td>
                <td>
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

        if (!email) {
            Swal.fire('Atención', 'El correo es requerido', 'warning');
            btnSaveUser.disabled = false;
            btnSaveUser.innerHTML = originalText;
            return;
        }

        try {
            // Check if exists
            const q = query(collection(db, "roles"), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
                // Update
                const docRef = doc(db, "roles", snap.docs[0].id);
                await updateDoc(docRef, { role });
            } else {
                // Insert
                await addDoc(collection(db, "roles"), { email, role });
            }
            
            const modalEl = document.getElementById('userModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            userForm.reset();
            
            await loadUsers();
            Swal.fire('¡Guardado!', 'El rol se ha guardado correctamente.', 'success');
        } catch(e) {
            Swal.fire('Error', 'Error: ' + e.message, 'error');
        } finally {
            btnSaveUser.disabled = false;
            btnSaveUser.innerHTML = originalText;
        }
    });

    usersTableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-user');
        if (btn) {
            const id = btn.dataset.id;
            Swal.fire({
                title: '¿Estás seguro?',
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
                        Swal.fire('¡Eliminado!', 'El rol ha sido eliminado.', 'success');
                    } catch(err) {
                        Swal.fire('Error', 'Error al eliminar: ' + err.message, 'error');
                    }
                }
            });
        }
    });
}
