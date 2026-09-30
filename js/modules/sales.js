import { db } from '../firebase-config.js';
import { collection, addDoc, doc, updateDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";


const saleProductInput = document.getElementById('sale-product-input');
const saleProductDatalist = document.getElementById('sale-product-datalist');
const saleCustomPrice = document.getElementById('sale-custom-price');
const saleQty = document.getElementById('sale-qty');
const btnAddToCart = document.getElementById('btn-add-to-cart');
const cartBody = document.getElementById('cart-body');
const saleTotalLabel = document.getElementById('sale-total');
const btnConfirmSale = document.getElementById('btn-confirm-sale');
const saleClient = document.getElementById('sale-client');
const salesTableBody = document.getElementById('sales-table-body');

// Payment method elements
const payCashRadio = document.getElementById('pay-cash');
const payQrRadio = document.getElementById('pay-qr');
const cashPaymentSection = document.getElementById('cash-payment-section');
const saleAmountPaid = document.getElementById('sale-amount-paid');
const saleChange = document.getElementById('sale-change');

let currentCart = [];
let availableProducts = []; // Store products to look them up by input value
let currentSales = [];
let salesCurrentPage = 1;
const salesRowsPerPage = 10;

export async function initSalesView() {
    if (!salesTableBody) return; // Only run on sales.html
    setupSales();

    // Populate product datalist for the modal
    saleProductDatalist.innerHTML = '';
    
    // We need to fetch products first since we are on a separate page
    const productsSnapshot = await getDocs(collection(db, "products"));
    availableProducts = [];
    productsSnapshot.forEach((doc) => {
        availableProducts.push({ id: doc.id, ...doc.data() });
    });
    
    availableProducts.forEach(p => {
        // Only show products with stock
        if (p.stock > 0) {
            const opt = document.createElement('option');
            opt.value = `${p.codigo} - ${p.descripcion}`;
            opt.dataset.id = p.id;
            saleProductDatalist.appendChild(opt);
        }
    });

    await loadSales();
}

function setupSales() {
    const paginationContainer = document.getElementById('sales-pagination');
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.sales-page-link');
            if (link) {
                const page = parseInt(link.dataset.page);
                if (!isNaN(page)) {
                    renderSalesPage(page);
                }
            }
        });
    }

    // Toggle Payment Method Section
    if (payCashRadio && payQrRadio && cashPaymentSection) {
        payCashRadio.addEventListener('change', () => {
            if (payCashRadio.checked) {
                cashPaymentSection.classList.remove('d-none');
            }
        });
        payQrRadio.addEventListener('change', () => {
            if (payQrRadio.checked) {
                cashPaymentSection.classList.add('d-none');
                saleAmountPaid.value = '';
                saleChange.textContent = '0.00';
            }
        });
    }

    // Calculate Change
    if (saleAmountPaid) {
        saleAmountPaid.addEventListener('input', () => {
            const total = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            const paid = parseFloat(saleAmountPaid.value);
            if (!isNaN(paid) && paid >= total) {
                saleChange.textContent = (paid - total).toFixed(2);
            } else {
                saleChange.textContent = '0.00';
            }
        });
    }

    // When a product is selected, default its price to P3 (Precio Venta)
    saleProductInput.addEventListener('change', () => {
        const selectedValue = saleProductInput.value;
        const matchedProduct = availableProducts.find(p => `${p.codigo} - ${p.descripcion}` === selectedValue);
        
        if (matchedProduct) {
            saleCustomPrice.value = matchedProduct.p3;
        } else {
            saleCustomPrice.value = '';
        }
    });

    // Add to Cart
    btnAddToCart.addEventListener('click', () => {
        const selectedValue = saleProductInput.value;
        const matchedProduct = availableProducts.find(p => `${p.codigo} - ${p.descripcion}` === selectedValue);
        
        const qty = parseInt(saleQty.value);
        const price = parseFloat(saleCustomPrice.value);

        if (!matchedProduct || isNaN(qty) || qty <= 0 || isNaN(price)) {
            Swal.fire('Atención', 'Por favor, selecciona un producto válido e ingresa cantidad y precio correctos.', 'warning');
            return;
        }

        const selectedId = matchedProduct.id;
        const productStock = parseInt(matchedProduct.stock);
        const productCodigo = matchedProduct.codigo;
        const productDesc = matchedProduct.descripcion;
        
        // Check if enough stock
        if (qty > productStock) {
            Swal.fire('Stock insuficiente', `Solo hay ${productStock} unidades disponibles.`, 'warning');
            return;
        }

        const existing = currentCart.find(item => item.product.id === selectedId);
        if (existing) {
            if (existing.qty + qty > productStock) {
                Swal.fire('Stock insuficiente', `No puedes agregar más. Solo hay ${productStock} en total.`, 'warning');
                return;
            }
            existing.qty += qty;
            existing.price = price; // update to latest custom price
        } else {
            currentCart.push({
                product: { id: selectedId, codigo: productCodigo, descripcion: productDesc, stock: productStock },
                qty,
                price
            });
        }

        updateCartUI();
        
        // Reset form
        saleProductInput.value = '';
        saleCustomPrice.value = '';
        saleQty.value = 1;
    });

    // Handle Confirm Sale
    btnConfirmSale.addEventListener('click', async () => {
        if (currentCart.length === 0) {
            Swal.fire('Carrito vacío', 'El carrito está vacío. Agrega productos primero.', 'info');
            return;
        }
        
        if (btnConfirmSale.disabled) return; // Prevent double click
        btnConfirmSale.disabled = true;
        const originalText = btnConfirmSale.innerHTML;
        btnConfirmSale.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

        try {
            const total = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
            const amountPaid = parseFloat(saleAmountPaid.value);
            
            if (paymentMethod === 'Efectivo') {
                if (isNaN(amountPaid) || amountPaid < total) {
                    Swal.fire('Atención', 'El monto pagado debe ser mayor o igual al total de la venta.', 'warning');
                    btnConfirmSale.disabled = false;
                    btnConfirmSale.innerHTML = originalText;
                    return;
                }
            }
            
            // 1. Create Sale Document
            const sale = {
                client: saleClient.value || "Público en general",
                date: new Date().toISOString(),
                total: total,
                paymentMethod: paymentMethod,
                amountPaid: paymentMethod === 'Efectivo' ? amountPaid : total,
                change: paymentMethod === 'Efectivo' ? (amountPaid - total) : 0,
                items: currentCart.map(item => ({
                    productId: item.product.id,
                    codigo: item.product.codigo,
                    descripcion: item.product.descripcion,
                    qty: item.qty,
                    price: item.price
                }))
            };

            await addDoc(collection(db, "sales"), sale);

            // 2. Deduct Stock from Products
            for (const item of currentCart) {
                const prodRef = doc(db, "products", item.product.id);
                const newStock = item.product.stock - item.qty;
                await updateDoc(prodRef, { stock: newStock });
            }

            // Success
            const modalEl = document.getElementById('saleModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            
            // Reset Cart
            currentCart = [];
            saleClient.value = '';
            saleAmountPaid.value = '';
            saleChange.textContent = '0.00';
            if (payCashRadio) payCashRadio.checked = true;
            if (cashPaymentSection) cashPaymentSection.classList.remove('d-none');
            updateCartUI();
            
            // Refresh tables
            await initSalesView(); // Reload sales view to update product stock and list
            
            Swal.fire('¡Venta Exitosa!', 'Venta registrada con éxito.', 'success');

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Error al confirmar venta: ' + e.message, 'error');
        } finally {
            btnConfirmSale.disabled = false;
            btnConfirmSale.innerHTML = originalText;
        }
    });

    // Remove from cart (Event delegation)
    cartBody.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-item')) {
            const index = e.target.closest('.btn-remove-item').dataset.index;
            currentCart.splice(index, 1);
            updateCartUI();
        }
    });

    // Handle Print Sale (Event delegation)
    salesTableBody.addEventListener('click', (e) => {
        const btnPrint = e.target.closest('.btn-print-sale');
        if (btnPrint) {
            try {
                const saleData = JSON.parse(decodeURIComponent(btnPrint.dataset.sale));
                printSale(saleData);
            } catch(err) {
                console.error("Error parsing sale data", err);
            }
        }
    });
}

function printSale(sale) {
    const dateObj = new Date(sale.date);
    const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
    
    let itemsHtml = '';
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td style="border-bottom: 1px solid #ddd; padding: 8px;">${item.qty}</td>
                <td style="border-bottom: 1px solid #ddd; padding: 8px;">${item.descripcion} (${item.codigo})</td>
                <td style="border-bottom: 1px solid #ddd; padding: 8px;">Bs${item.price.toFixed(2)}</td>
                <td style="border-bottom: 1px solid #ddd; padding: 8px;">Bs${(item.qty * item.price).toFixed(2)}</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Nota de Venta</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
                .header-info { text-align: right; }
                .header-info h2 { margin: 0; color: #dc3545; font-size: 28px; letter-spacing: 1px; }
                .header-info p { margin: 5px 0 0 0; font-size: 16px; color: #666; text-transform: uppercase; letter-spacing: 2px; }
                .logo-placeholder { width: 120px; height: 80px; background-color: #f8f9fa; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #aaa; font-weight: bold; border-radius: 8px; }
                .details { margin-bottom: 30px; font-size: 15px; }
                .details strong { min-width: 130px; display: inline-block; color: #555; }
                .details div { margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { text-align: left; background: #f8f9fa; padding: 12px 15px; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600; text-transform: uppercase; font-size: 13px; }
                td { padding: 12px 15px; border-bottom: 1px solid #eee; }
                .total-container { display: flex; justify-content: flex-end; }
                .total { text-align: right; font-size: 1.3em; font-weight: bold; padding: 15px 20px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #eee; }
                .total span { color: #dc3545; margin-left: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-placeholder">LOGO AQUI</div>
                <div class="header-info">
                    <h2>Repuestos Hamilton</h2>
                    <p>Nota de Venta</p>
                </div>
            </div>
            <div class="details">
                <div><strong>Fecha:</strong> ${dateStr}</div>
                <div><strong>Cliente:</strong> ${sale.client}</div>
                <div><strong>Método de Pago:</strong> ${sale.paymentMethod || 'Efectivo'}</div>
                ${(sale.paymentMethod || 'Efectivo') === 'Efectivo' && sale.amountPaid ? `<div><strong>Monto Pagado:</strong> Bs${sale.amountPaid.toFixed(2)}</div><div><strong>Cambio:</strong> Bs${sale.change.toFixed(2)}</div>` : ''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Cant.</th>
                        <th>Descripción</th>
                        <th>P. Unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <div class="total-container">
                <div class="total">
                    Total: <span>Bs${sale.total.toFixed(2)}</span>
                </div>
            </div>
            <script>
                window.onload = () => { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function updateCartUI() {
    cartBody.innerHTML = '';
    let total = 0;
    
    currentCart.forEach((item, index) => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product.descripcion} <br><small class="text-muted">${item.product.codigo}</small></td>
            <td>${item.qty}</td>
            <td>Bs${item.price.toFixed(2)}</td>
            <td>Bs${subtotal.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger btn-remove-item" data-index="${index}">
                    <i class="bi bi-x"></i>
                </button>
            </td>
        `;
        cartBody.appendChild(tr);
    });

    saleTotalLabel.textContent = total.toFixed(2);
    
    // Recalculate change if paid amount is entered
    if (saleAmountPaid && saleChange) {
        const paid = parseFloat(saleAmountPaid.value);
        if (!isNaN(paid) && paid >= total) {
            saleChange.textContent = (paid - total).toFixed(2);
        } else {
            saleChange.textContent = '0.00';
        }
    }
}



async function loadSales() {
    salesTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="spinner-border text-primary my-3" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </td>
        </tr>
    `;
    try {
        const q = query(collection(db, "sales"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        
        currentSales = [];
        querySnapshot.forEach((doc) => {
            currentSales.push(doc.data());
        });
        
        renderSalesPage(1);
    } catch (e) {
        console.error("Error loading sales:", e);
        salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar ventas</td></tr>';
    }
}

function renderSalesPage(page) {
    salesCurrentPage = page;
    const startIndex = (page - 1) * salesRowsPerPage;
    const endIndex = startIndex + salesRowsPerPage;
    const paginatedItems = currentSales.slice(startIndex, endIndex);
    
    salesTableBody.innerHTML = '';
    
    if (paginatedItems.length === 0) {
        salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ventas registradas.</td></tr>';
        const paginationContainer = document.getElementById('sales-pagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    paginatedItems.forEach((sale) => {
        const tr = document.createElement('tr');
        
        // Format date nicely
        const dateObj = new Date(sale.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const totalItems = sale.items.reduce((acc, item) => acc + item.qty, 0);

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${sale.client}</td>
            <td class="fw-bold text-success">Bs${sale.total.toFixed(2)}</td>
            <td>${totalItems} unids.</td>
            <td>
                <button class="btn btn-sm btn-outline-info btn-print-sale" data-sale="${encodeURIComponent(JSON.stringify(sale))}" title="Imprimir Nota"><i class="bi bi-printer"></i></button>
            </td>
        `;
        salesTableBody.appendChild(tr);
    });
    
    renderSalesPagination();
}

function renderSalesPagination() {
    const totalPages = Math.ceil(currentSales.length / salesRowsPerPage);
    const paginationContainer = document.getElementById('sales-pagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = `<nav aria-label="Page navigation"><ul class="pagination mb-0">`;
    
    html += `<li class="page-item ${salesCurrentPage === 1 ? 'disabled' : ''}">
      <a class="page-link sales-page-link" href="#" data-page="${salesCurrentPage - 1}" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${salesCurrentPage === i ? 'active' : ''}"><a class="page-link sales-page-link" href="#" data-page="${i}">${i}</a></li>`;
    }

    html += `<li class="page-item ${salesCurrentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link sales-page-link" href="#" data-page="${salesCurrentPage + 1}" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
      </a>
    </li>`;

    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;
}
