import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js';
import { logAction } from './logger.js';

const inventoryTableBody = document.getElementById('inventory-table-body');
const productForm = document.getElementById('product-form');
const btnSaveProduct = document.getElementById('btn-save-product');

export let currentProducts = [];
export let filteredProducts = [];
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
        populateInventoryFilters();
        applyInventoryFilters();
    } catch (e) {
        console.error("Error fetching products:", e);
    } finally {
        hideLoading();
    }
}

function populateInventoryFilters() {
    const filterBrand = document.getElementById('inv-filter-brand');
    if (!filterBrand) return;

    const brands = new Set();
    currentProducts.forEach(p => {
        if (p.marca) brands.add(p.marca);
    });

    filterBrand.innerHTML = '<option value="">Todas las marcas</option>';
    brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        filterBrand.appendChild(opt);
    });
}

function applyInventoryFilters() {
    const searchVal = (document.getElementById('inv-filter-search')?.value || '').toLowerCase();
    const brandVal = document.getElementById('inv-filter-brand')?.value || '';
    const statusVal = document.getElementById('inv-filter-status')?.value || 'activos';

    filteredProducts = currentProducts.filter(p => {
        const matchBrand = brandVal ? p.marca === brandVal : true;
        const searchStr = `${p.codigo} ${p.descripcion}`.toLowerCase();
        const matchSearch = searchVal ? searchStr.includes(searchVal) : true;
        const matchStatus = statusVal === 'baja' ? p.estado === 'baja' : p.estado !== 'baja';
        
        return matchBrand && matchSearch && matchStatus;
    });

    renderInventoryPage(1);
}

function renderInventoryPage(page) {
    currentPage = page;
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = filteredProducts.slice(startIndex, endIndex);

    if (filteredProducts.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay productos que coincidan.</td></tr>';
        renderPagination();
        return;
    }

    inventoryTableBody.innerHTML = '';
    paginatedItems.forEach(p => {
        const tr = document.createElement('tr');
        
        let actionButtons = '';
        if (p.estado === 'baja') {
            actionButtons = `
                <button class="btn btn-sm btn-outline-success btn-restore-product rounded-0 admin-only" data-id="${p.id}" title="Restaurar Producto"><i class="bi bi-arrow-counterclockwise"></i></button>
            `;
        } else {
            actionButtons = `
                <button class="btn btn-sm btn-outline-primary me-1 btn-edit-product rounded-0 admin-only" data-id="${p.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete-product rounded-0 admin-only" data-id="${p.id}" title="Dar de baja"><i class="bi bi-x-circle"></i></button>
            `;
        }
        
        tr.innerHTML = `
            <td class="fw-bold ${p.estado === 'baja' ? 'text-decoration-line-through text-muted' : ''}">${p.codigo}</td>
            <td class="${p.estado === 'baja' ? 'text-muted' : ''}">${p.sust || '-'}</td>
            <td>
                <div class="${p.estado === 'baja' ? 'text-muted' : ''}">${p.descripcion}</div>
                ${p.estado === 'baja' && p.motivoBaja ? `<small class="text-danger fw-bold" style="font-size:0.7rem;">MOTIVO: ${p.motivoBaja}</small>` : ''}
            </td>
            <td class="${p.estado === 'baja' ? 'text-muted' : ''}">${p.marca || '-'}</td>
            <td class="${p.estado === 'baja' ? 'text-muted' : 'text-danger fw-bold'}">Bs${Number(p.p1).toFixed(2)}</td>
            <td class="${p.estado === 'baja' ? 'text-muted' : 'text-warning fw-bold'}">Bs${Number(p.p2).toFixed(2)}</td>
            <td class="${p.estado === 'baja' ? 'text-muted' : 'text-success fw-bold'}">Bs${Number(p.p3).toFixed(2)}</td>
            <td><span class="badge ${p.stock > 5 ? (p.estado==='baja'?'bg-secondary':'bg-success') : (p.estado==='baja'?'bg-secondary':'bg-danger')}">${p.stock}</span></td>
            <td>
                ${actionButtons}
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
    
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);
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

    const searchInput = document.getElementById('inv-filter-search');
    if (searchInput) searchInput.addEventListener('input', applyInventoryFilters);

    const brandSelect = document.getElementById('inv-filter-brand');
    if (brandSelect) brandSelect.addEventListener('change', applyInventoryFilters);
    
    const statusSelect = document.getElementById('inv-filter-status');
    if (statusSelect) statusSelect.addEventListener('change', applyInventoryFilters);

    const btnExport = document.getElementById('btn-export-inventory');
    if (btnExport) btnExport.addEventListener('click', exportInventoryExcel);

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
                await logAction("Editar Producto", "Inventario", `Editó el producto ${newProduct.codigo}`);
            } else {
                await addDoc(collection(db, "products"), newProduct);
                await logAction("Crear Producto", "Inventario", `Creó el producto ${newProduct.codigo}`);
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
        const btnRestore = e.target.closest('.btn-restore-product');

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
                title: 'Dar de baja',
                text: "Por favor, ingresa el motivo por el cual se da de baja este producto:",
                input: 'textarea',
                icon: 'warning',
                inputPlaceholder: 'Ej. Repuesto dañado, descontinuado...',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, dar de baja',
                cancelButtonText: 'Cancelar',
                customClass: {
                    confirmButton: 'rounded-0',
                    cancelButton: 'rounded-0',
                    popup: 'rounded-0 border border-dark'
                },
                inputValidator: (value) => {
                    if (!value || value.trim() === '') {
                        return '¡Necesitas escribir un motivo!'
                    }
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const prodRef = doc(db, "products", id);
                        await updateDoc(prodRef, {
                            estado: 'baja',
                            motivoBaja: result.value.trim(),
                            fechaBaja: new Date().toISOString()
                        });
                        await logAction("Dar de baja", "Inventario", `Dio de baja el producto con motivo: ${result.value.trim()}`);
                        await loadProducts();
                        Swal.fire({
                            title: '¡Dado de baja!',
                            text: 'El repuesto ya no aparecerá en el inventario activo.',
                            icon: 'success',
                            customClass: {
                                confirmButton: 'rounded-0 btn btn-danger',
                                popup: 'rounded-0 border border-dark'
                            }
                        });
                    } catch(err) {
                        Swal.fire('Error', 'Error al dar de baja: ' + err.message, 'error');
                    }
                }
            });
        }
        
        if (btnRestore) {
            const id = btnRestore.dataset.id;
            Swal.fire({
                title: '¿Restaurar Producto?',
                text: "Este producto volverá a estar activo y disponible para ventas.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, restaurar',
                cancelButtonText: 'Cancelar',
                customClass: {
                    confirmButton: 'rounded-0',
                    cancelButton: 'rounded-0',
                    popup: 'rounded-0 border border-dark'
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const prodRef = doc(db, "products", id);
                        await updateDoc(prodRef, {
                            estado: 'activo'
                        });
                        await logAction("Restaurar Producto", "Inventario", `Restauró el producto con ID ${id}`);
                        await loadProducts();
                        Swal.fire({
                            title: '¡Restaurado!',
                            text: 'El producto vuelve a estar activo.',
                            icon: 'success',
                            customClass: {
                                confirmButton: 'rounded-0 btn btn-success',
                                popup: 'rounded-0 border border-dark'
                            }
                        });
                    } catch(err) {
                        Swal.fire('Error', 'Error al restaurar: ' + err.message, 'error');
                    }
                }
            });
        }
    });
}

function exportInventoryExcel() {
    if (filteredProducts.length === 0) {
        Swal.fire('Sin datos', 'No hay datos para exportar con los filtros actuales.', 'info');
        return;
    }

    try {
        const dateStr = new Date().toISOString().split('T')[0];
        
        // Define Excel Data Array of Arrays (AOA)
        const aoa = [
            ["REPUESTOS HAMILTON"],
            ["REPORTE DE INVENTARIO"],
            ["Fecha:", dateStr],
            [],
            ["Código", "Sustituto", "Descripción", "Marca", "Precio Compra (Bs)", "Precio Límite (Bs)", "Precio Venta (Bs)", "Stock"]
        ];
        
        // Add all rows
        filteredProducts.forEach(p => {
            aoa.push([
                p.codigo,
                p.sust || '-',
                p.descripcion,
                p.marca || '-',
                p.p1 || 0,
                p.p2 || 0,
                p.p3 || 0,
                p.stock || 0
            ]);
        });

        // Create workbook and worksheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        
        // --- STYLING ---
        const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } }, alignment: { horizontal: "center" } };
        const subtitleStyle = { font: { bold: true, sz: 12 } };
        const boldStyle = { font: { bold: true } };
        const headerRowStyle = { 
            font: { bold: true, color: { rgb: "FFFFFF" } }, 
            fill: { fgColor: { rgb: "343A40" } },
            border: { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }
        };

        ws["A1"].s = titleStyle;
        ws["A2"].s = subtitleStyle;
        ws["A3"].s = boldStyle;

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // A1:H1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }  // A2:H2
        ];

        // Headers
        const cols = ["A", "B", "C", "D", "E", "F", "G", "H"];
        cols.forEach(c => {
            if (ws[`${c}5`]) ws[`${c}5`].s = headerRowStyle;
        });

        // Data rows
        for (let r = 5; r < 5 + filteredProducts.length; r++) {
            cols.forEach(c => {
                if (ws[`${c}${r+1}`]) {
                    ws[`${c}${r+1}`].s = { border: { top: {style:'thin', color:{auto:1}}, bottom: {style:'thin', color:{auto:1}}, left: {style:'thin', color:{auto:1}}, right: {style:'thin', color:{auto:1}} } };
                    
                    // Currency format for columns E, F, G (P1, P2, P3)
                    if (["E", "F", "G"].includes(c)) {
                        ws[`${c}${r+1}`].s.numFmt = '"Bs "#,##0.00';
                    }
                }
            });
        }

        // Column Widths
        ws['!cols'] = [
            { wch: 20 }, // Codigo
            { wch: 15 }, // Sust
            { wch: 45 }, // Descripcion
            { wch: 20 }, // Marca
            { wch: 20 }, // P1
            { wch: 20 }, // P2
            { wch: 20 }, // P3
            { wch: 15 }  // Stock
        ];

        XLSX.writeFile(wb, `Inventario_Hamilton_${dateStr}.xlsx`);
    } catch (err) {
        console.error("Error exporting to Excel:", err);
        Swal.fire('Error', 'Hubo un problema al generar el archivo Excel.', 'error');
    }
}
