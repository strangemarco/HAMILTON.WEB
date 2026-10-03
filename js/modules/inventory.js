import { supabase } from '../supabase-config.js';

import { showLoading, hideLoading } from './ui.js';
import { logAction } from './logger.js';

const inventoryTableBody = document.getElementById('inventory-table-body');
const productForm = document.getElementById('product-form');
const btnSaveProduct = document.getElementById('btn-save-product');

export let currentProducts = [];
export let filteredProducts = [];
let currentPage = 1;
const rowsPerPage = 10;


    // --- IMPORT LOGIC ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('excel-file-input');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.replace('bg-light', 'bg-white');
            dropZone.classList.replace('border-dashed', 'border-primary');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.replace('bg-white', 'bg-light');
            dropZone.classList.replace('border-primary', 'border-dashed');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.replace('bg-white', 'bg-light');
            dropZone.classList.replace('border-primary', 'border-dashed');
            if (e.dataTransfer.files.length) {
                handleExcelFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleExcelFile(e.target.files[0]);
            }
            fileInput.value = ''; // Reset
        });
    }

    async function handleExcelFile(file) {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            return Swal.fire('Error', 'Por favor sube un archivo Excel v�lido.', 'error');
        }

        dropZone.innerHTML = '<div class="spinner-border text-primary my-3"></div><p>Procesando Excel...</p>';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) {
                    throw new Error("El archivo est� vac�o.");
                }

                // Normalizar keys
                // Parse as array of arrays to find the real header row
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                if (rawData.length === 0) throw new Error("El archivo está vacío.");

                let headerRowIndex = -1;
                let headerMap = {}; // Maps our internal key to the column index

                // Find the header row by looking for 'cod' and 'desc'
                for (let i = 0; i < rawData.length && i < 20; i++) {
                    const row = rawData[i];
                    if (!row || !Array.isArray(row)) continue;
                    
                    let foundCod = -1, foundDesc = -1;
                    
                    row.forEach((col, idx) => {
                        if (typeof col !== 'string') return;
                        const lower = col.toLowerCase();
                        if (lower.includes('cod') || lower.includes('código') || lower.includes('cdigo')) foundCod = idx;
                        if (lower.includes('desc')) foundDesc = idx;
                    });

                    if (foundCod !== -1 && foundDesc !== -1) {
                        headerRowIndex = i;
                        // Map all columns
                        row.forEach((col, idx) => {
                            if (typeof col !== 'string') return;
                            const lower = col.toLowerCase();
                            if (lower.includes('cod') || lower.includes('código') || lower.includes('cdigo')) {
                                if (lower.includes('sust') || lower.includes('sus')) {
                                    headerMap.sust = idx;
                                } else {
                                    headerMap.codigo = idx;
                                }
                            }
                            if (lower.includes('desc')) headerMap.descripcion = idx;
                            if (lower.includes('marca')) headerMap.marca = idx;
                            if (lower.includes('p1') || lower.includes('compra')) headerMap.p1 = idx;
                            if (lower.includes('p2') || lower.includes('limite') || lower.includes('límite')) headerMap.p2 = idx;
                            if (lower.includes('p3') || lower.includes('venta')) headerMap.p3 = idx;
                            if (lower.includes('stock') || lower.includes('cant') || lower.includes('actual')) headerMap.stock = idx;
                        });
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error("No se pudo encontrar la fila de encabezados. Asegúrate de que existan columnas como 'Código' y 'Descripción'.");
                }

                let toInsert = [];
                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0) continue;
                    
                    const val = (key) => row[headerMap[key]] !== undefined ? String(row[headerMap[key]]).trim() : '';
                    
                    const codigo = val('codigo');
                    if (!codigo || codigo === '') continue; // Ignorar filas vacías

                    // Parse numbers, cleaning "Bs " or currency symbols
                    const parseMoney = (str) => {
                        const clean = str.replace(/[^0-9.,-]/g, '').replace(',', '.');
                        return parseFloat(clean) || 0;
                    };

                    toInsert.push({
                        codigo: codigo,
                        sust: val('sust'),
                        descripcion: val('descripcion'),
                        marca: val('marca'),
                        p1: parseMoney(val('p1')),
                        p2: parseMoney(val('p2')),
                        p3: parseMoney(val('p3')),
                        stock: parseInt(val('stock')) || 0
                    });
                }

                // Deduplicar dentro del mismo excel (quedarse con el último)
                const uniqueProductsMap = new Map();
                for (const p of toInsert) {
                    uniqueProductsMap.set(p.codigo, p);
                }
                const uniqueProducts = Array.from(uniqueProductsMap.values());

                // Batch Insert/Upsert to Supabase
                dropZone.innerHTML = '<div class="spinner-border text-success my-3"></div><p>Guardando en la base de datos...</p>';
                
                const batchSize = 500;
                for (let i = 0; i < uniqueProducts.length; i += batchSize) {
                    const batch = uniqueProducts.slice(i, i + batchSize);
                    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'codigo' });
                    if (error) throw error;
                }

                await logAction("Importar Excel", "Inventario", `Se procesaron ${uniqueProducts.length} productos`);
                
                const modalEl = document.getElementById('importModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                Swal.fire('¡Éxito!', `Se procesaron e importaron ${uniqueProducts.length} productos correctamente.`, 'success');
                await loadProducts();
            } catch (err) {
                Swal.fire('Error al procesar', err.message, 'error');
            } finally {
                // Restore dropzone
                dropZone.innerHTML = `
                    <i class="bi bi-file-earmark-spreadsheet fs-1 text-success mb-3"></i>
                    <p class="mb-1 fw-bold">Arrastra tu Excel aqu�</p>
                    <p class="text-muted small">o haz clic para buscar</p>
                    <input type="file" id="excel-file-input" class="d-none" accept=".xlsx, .xls">
                `;
            }
        };
        reader.readAsArrayBuffer(file);
    }


export async function initInventory() {
    if (!inventoryTableBody) return; // Only run on inventory.html
    setupInventory();
    
    // Auto-fill search if coming from notifications
    const params = new URLSearchParams(window.location.search);
    const searchVal = params.get('search');
    if (searchVal) {
        const searchInput = document.getElementById('inv-filter-search');
        if (searchInput) searchInput.value = searchVal;
    }
    
    await loadProducts();
}

export async function loadProducts() {
    inventoryTableBody.innerHTML = '';
    showLoading();
    currentProducts = [];
    
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        currentProducts = data;
        
        populateInventoryFilters();
        applyInventoryFilters();
    } catch (e) {
        console.error("Error fetching products:", e);
    } finally {
        hideLoading();
    }
}


function populateInventoryFilters() {
    const filterBrandList = document.getElementById('inv-filter-brand-list');
    if (!filterBrandList) return;

    const brands = new Set();
    currentProducts.forEach(p => {
        if (p.marca) brands.add(p.marca);
    });

    filterBrandList.innerHTML = '<li><a class="dropdown-item brand-item" href="#" data-value="">Todas las marcas</a></li>';
    brands.forEach(b => {
        const li = document.createElement('li');
        li.innerHTML = `<a class="dropdown-item brand-item" href="#" data-value="${b}">${b}</a>`;
        filterBrandList.appendChild(li);
    });

    document.querySelectorAll('.brand-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const val = e.target.dataset.value;
            const text = e.target.textContent;
            document.getElementById('inv-filter-brand').value = val;
            document.getElementById('brand-dropdown-btn').textContent = text;
            
            const event = new Event('change');
            document.getElementById('inv-filter-brand').dispatchEvent(event);
        });
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
        if (p.estado === 'baja') {
            tr.classList.add('table-active');
        }
        
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
            <th scope="row" class="font-monospace ${p.estado === 'baja' ? 'text-decoration-line-through text-muted' : ''}">${p.codigo}</th>
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

export let issetupInventoryDone = false;
function setupInventory() {
    if (issetupInventoryDone) return;
    issetupInventoryDone = true;
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
            created_at: new Date().toISOString(),
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
                
                const { error } = await supabase.from('products').update(newProduct).eq('id', id);
                if (error) throw error;
                await logAction("Editar Producto", "Inventario", `Editó el producto ${newProduct.codigo}`);
            } else {
                const { error } = await supabase.from('products').insert([newProduct]);
                if (error) throw error;
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
                        
                        const { error } = await supabase.from('products').update({ estado: 'baja', motivoBaja: result.value.trim(), fechaBaja: new Date().toISOString() }).eq('id', id); if(error) throw error;
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
                        
                        const { error } = await supabase.from('products').update({ estado: 'activos', motivoBaja: null, fechaBaja: null }).eq('id', id); if(error) throw error;
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



