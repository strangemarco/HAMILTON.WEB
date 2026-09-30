import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js';

const inventoryTableBody = document.getElementById('inventory-table-body');
const productForm = document.getElementById('product-form');
const btnSaveProduct = document.getElementById('btn-save-product');

export let currentProducts = [];
let currentPage = 1;
const rowsPerPage = 10;

export async function initInventory() {
    if (!inventoryTableBody) return; // Only run on inventory.html
    setupInventory();
    await loadProducts();
}

export async function loadProducts() {
    inventoryTableBody.innerHTML = '';
    showLoading();
    currentProducts = [];
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        querySnapshot.forEach((doc) => {
            currentProducts.push({ id: doc.id, ...doc.data() });
        });
        renderInventoryPage(1);
    } catch (e) {
        console.error("Error fetching products:", e);
    } finally {
        hideLoading();
    }
}

function renderInventoryPage(page) {
    currentPage = page;
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = currentProducts.slice(startIndex, endIndex);

    if (currentProducts.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay productos registrados.</td></tr>';
        renderPagination();
        return;
    }

    inventoryTableBody.innerHTML = '';
    paginatedItems.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${p.codigo}</td>
            <td>${p.sust || '-'}</td>
            <td>${p.descripcion}</td>
            <td>${p.marca || '-'}</td>
            <td class="text-danger fw-bold">Bs${Number(p.p1).toFixed(2)}</td>
            <td class="text-warning fw-bold">Bs${Number(p.p2).toFixed(2)}</td>
            <td class="text-success fw-bold">Bs${Number(p.p3).toFixed(2)}</td>
            <td><span class="badge ${p.stock > 5 ? 'bg-success' : 'bg-danger'}">${p.stock}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1 btn-edit-product" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="bi bi-trash"></i></button>
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
    
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(currentProducts.length / rowsPerPage);
    const paginationContainer = document.getElementById('inventory-pagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = `<nav aria-label="Page navigation"><ul class="pagination mb-0">`;
    
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link inventory-page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${currentPage === i ? 'active' : ''}"><a class="page-link inventory-page-link" href="#" data-page="${i}">${i}</a></li>`;
    }

    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link inventory-page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
      </a>
    </li>`;

    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;
}

export function setupInventory() {
    const paginationContainer = document.getElementById('inventory-pagination');
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.inventory-page-link');
            if (link) {
                const page = parseInt(link.dataset.page);
                if (!isNaN(page)) {
                    renderInventoryPage(page);
                }
            }
        });
    }

    btnSaveProduct.addEventListener('click', async () => {
        // Fix para evitar que se guarde dos veces si se da doble click rapido
        if (btnSaveProduct.disabled) return;
        
        btnSaveProduct.disabled = true;
        const originalText = btnSaveProduct.innerHTML;
        btnSaveProduct.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

        const id = document.getElementById('prod-id').value;
        const newProduct = {
            codigo: document.getElementById('prod-codigo').value,
            sust: document.getElementById('prod-sust').value,
            marca: document.getElementById('prod-marca').value,
            descripcion: document.getElementById('prod-descripcion').value,
            p1: parseFloat(document.getElementById('prod-p1').value),
            p2: parseFloat(document.getElementById('prod-p2').value),
            p3: parseFloat(document.getElementById('prod-p3').value),
            stock: parseInt(document.getElementById('prod-stock').value)
        };

        try {
            if (id) {
                const prodRef = doc(db, "products", id);
                await updateDoc(prodRef, newProduct);
            } else {
                await addDoc(collection(db, "products"), newProduct);
            }
            
            // Hide Modal
            const modalEl = document.getElementById('productModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            productForm.reset();
            document.getElementById('prod-id').value = '';
            
            // Reload
            await loadProducts();
            Swal.fire('¡Éxito!', 'Producto guardado correctamente', 'success');
        } catch (e) {
            Swal.fire('Error', 'Error al guardar: ' + e.message, 'error');
        } finally {
            // Restore button
            btnSaveProduct.disabled = false;
            btnSaveProduct.innerHTML = originalText;
        }
    });

    inventoryTableBody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-product');
        const btnDelete = e.target.closest('.btn-delete-product');

        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const product = currentProducts.find(p => p.id === id);
            if (product) {
                document.getElementById('prod-id').value = product.id;
                document.getElementById('prod-codigo').value = product.codigo;
                document.getElementById('prod-sust').value = product.sust || '';
                document.getElementById('prod-marca').value = product.marca || '';
                document.getElementById('prod-descripcion').value = product.descripcion;
                document.getElementById('prod-p1').value = product.p1;
                document.getElementById('prod-p2').value = product.p2;
                document.getElementById('prod-p3').value = product.p3;
                document.getElementById('prod-stock').value = product.stock;
                
                const modalEl = document.getElementById('productModal');
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        }

        if (btnDelete) {
            const id = btnDelete.dataset.id;
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
                        await deleteDoc(doc(db, "products", id));
                        await loadProducts();
                        Swal.fire('¡Eliminado!', 'El repuesto ha sido eliminado.', 'success');
                    } catch(err) {
                        Swal.fire('Error', 'Error al eliminar: ' + err.message, 'error');
                    }
                }
            });
        }
    });
}
