import { supabase } from '../supabase-config.js';

import { logAction } from './logger.js';


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
const saleIdInput = document.getElementById('sale-id');
const payMixedRadio = document.getElementById('pay-mixed');
const mixedPaymentSection = document.getElementById('mixed-payment-section');
const saleMixedCash = document.getElementById('sale-mixed-cash');
const saleMixedQr = document.getElementById('sale-mixed-qr');

let currentCart = [];
let editingOldSale = null;
let availableProducts = []; // Store products to look them up by input value
let currentSales = [];
let filteredSales = [];
let salesCurrentPage = 1;
const salesRowsPerPage = 10;
let isSalesSetup = false;

export async function initSalesView() {
    if (!salesTableBody) return; // Only run on sales.html
    if (!isSalesSetup) {
        setupSales();
        isSalesSetup = true;
    }

    // Populate product datalist for the modal
    saleProductDatalist.innerHTML = '';
    
    // We need to fetch products first since we are on a separate page
    const { data: prods } = await supabase.from('products').select('*');
    availableProducts = prods || [];
    

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

let issetupSalesDone = false;
function setupSales() {
    if (issetupSalesDone) return;
    issetupSalesDone = true;
    const filterStart = document.getElementById('sales-filter-start');
    const filterEnd = document.getElementById('sales-filter-end');
    const btnExport = document.getElementById('btn-export-sales');
    if (filterStart) filterStart.addEventListener('change', applySalesFilters);
    if (filterEnd) filterEnd.addEventListener('change', applySalesFilters);
    if (btnExport) btnExport.addEventListener('click', exportSalesToExcel);
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
    if (payCashRadio && payQrRadio && payMixedRadio) {
        payCashRadio.addEventListener('change', () => {
            if (payCashRadio.checked) {
                cashPaymentSection.classList.remove('d-none');
                mixedPaymentSection.classList.add('d-none');
            }
        });
        payQrRadio.addEventListener('change', () => {
            if (payQrRadio.checked) {
                cashPaymentSection.classList.add('d-none');
                mixedPaymentSection.classList.add('d-none');
                saleAmountPaid.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
            saleChange.textContent = '0.00';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
            }
        });
        payMixedRadio.addEventListener('change', () => {
            if (payMixedRadio.checked) {
                cashPaymentSection.classList.add('d-none');
                mixedPaymentSection.classList.remove('d-none');
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
            
            let finalPaymentMethodStr = paymentMethod;
            let finalAmountPaid = total;
            let finalChange = 0;

            if (paymentMethod === 'Efectivo') {
                if (isNaN(amountPaid) || amountPaid < total) {
                    Swal.fire('Atención', 'El monto pagado debe ser mayor o igual al total de la venta.', 'warning');
                    btnConfirmSale.disabled = false;
                    btnConfirmSale.innerHTML = originalText;
                    return;
                }
                finalAmountPaid = amountPaid;
                finalChange = amountPaid - total;
            } else if (paymentMethod === 'Mixto') {
                const mCash = parseFloat(saleMixedCash.value) || 0;
                const mQr = parseFloat(saleMixedQr.value) || 0;
                if (mCash + mQr < total) {
                    Swal.fire('Atención', 'La suma de Efectivo y QR debe cubrir el total de la venta.', 'warning');
                    btnConfirmSale.disabled = false;
                    btnConfirmSale.innerHTML = originalText;
                    return;
                }
                finalAmountPaid = mCash + mQr;
                finalChange = finalAmountPaid - total;
                // mCash is how much cash they gave.
                const effectiveCash = mCash - finalChange;
                finalPaymentMethodStr = `Mixto|${effectiveCash}|${mQr}`;
            }
            
            const loggedUser = JSON.parse(localStorage.getItem('hamilton_user') || '{}');
            const fullName = `${loggedUser.nombre || ''} ${loggedUser.apellido || ''}`.trim();
            const sellerName = fullName || loggedUser.email || 'Vendedor Default';

            // 1. Create Sale Document
            const sale = {
                client: saleClient.value || "Público en general",
                seller: sellerName,
                date: new Date().toISOString(),
                total: total,
                paymentMethod: finalPaymentMethodStr,
                amountPaid: finalAmountPaid,
                change: finalChange,
                items: currentCart.map(item => ({
                    productId: item.product.id,
                    codigo: item.product.codigo,
                    descripcion: item.product.descripcion,
                    qty: item.qty,
                    price: item.price
                }))
            };

            if (saleIdInput.value) {
                // We are editing an existing sale
                // 1. Revert old stock
                if (editingOldSale) {
                    for (const oldItem of editingOldSale.items) {
                        const { data: pData } = await supabase.from('products').select('stock').eq('id', oldItem.productId).single();
                        if (pData) {
                            await supabase.from('products').update({ stock: pData.stock + oldItem.qty }).eq('id', oldItem.productId);
                        }
                    }
                }
                
                // 2. Deduct new stock
                for (const item of currentCart) {
                    const { data: pData } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
                    if (pData) {
                        await supabase.from('products').update({ stock: pData.stock - item.qty }).eq('id', item.product.id);
                    }
                }

                // 3. Update Sale Doc
                sale.date = editingOldSale.date;
                const salePayload = {
                    client: sale.client,
                    seller_name: sale.seller,
                    date: sale.date,
                    total: sale.total,
                    payment_method: sale.paymentMethod,
                    amount_paid: sale.amountPaid,
                    change: sale.change
                };
                const { error: saleErr } = await supabase.from('sales').update(salePayload).eq('id', saleIdInput.value);
                if (saleErr) throw saleErr;
                
                // 4. Update items (delete old, insert new)
                await supabase.from('sale_items').delete().eq('sale_id', saleIdInput.value);
                const saleItems = currentCart.map(item => ({
                    sale_id: saleIdInput.value,
                    product_id: item.product.id,
                    codigo: item.product.codigo,
                    descripcion: item.product.descripcion,
                    qty: item.qty,
                    price: item.price
                }));
                await supabase.from('sale_items').insert(saleItems);

                await logAction("Editar Venta", "Ventas", `Editó la venta del cliente ${sale.client} con ID ${saleIdInput.value}`);
            } else {
                // New sale
                const salePayload = {
                    client: sale.client,
                    seller_name: sale.seller,
                    date: sale.date,
                    total: sale.total,
                    payment_method: sale.paymentMethod,
                    amount_paid: sale.amountPaid,
                    change: sale.change
                };
                const { data: newSale, error: saleErr } = await supabase.from('sales').insert([salePayload]).select().single();
                if (saleErr) throw saleErr;

                // Insert items
                const saleItems = currentCart.map(item => ({
                    sale_id: newSale.id,
                    product_id: item.product.id,
                    codigo: item.product.codigo,
                    descripcion: item.product.descripcion,
                    qty: item.qty,
                    price: item.price
                }));
                const { error: itemErr } = await supabase.from('sale_items').insert(saleItems);
                if (itemErr) throw itemErr;

                await logAction("Registrar Venta", "Ventas", `Registró una nueva venta por Bs${sale.total.toFixed(2)} para ${sale.client}`);

                // 2. Deduct Stock from Products
                for (const item of currentCart) {
                    const { data: pData } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
                    if (pData) {
                        await supabase.from('products').update({ stock: pData.stock - item.qty }).eq('id', item.product.id);
                    }
                }
            }

            // Success
            const modalEl = document.getElementById('saleModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            
            // Reset Cart
            currentCart = [];
            editingOldSale = null;
            saleIdInput.value = '';
            saleClient.value = '';
            saleAmountPaid.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
            saleChange.textContent = '0.00';
            if (payCashRadio) payCashRadio.checked = true;
            if (cashPaymentSection) cashPaymentSection.classList.remove('d-none');
            if (mixedPaymentSection) mixedPaymentSection.classList.add('d-none');
            updateCartUI();
            
            // Refresh tables
            await initSalesView(); // Reload sales view to update product stock and list
            
            Swal.fire('¡Venta Exitosa!', 'Venta registrada con éxito.', 'success').then(() => {
                // Auto-print after closing the success modal
                printSale(sale);
            });

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

    // Handle Print & Edit Sale (Event delegation)
    salesTableBody.addEventListener('click', (e) => {
        const btnPrint = e.target.closest('.btn-print-sale');
        const btnEdit = e.target.closest('.btn-edit-sale');
        
        if (btnPrint) {
            try {
                const saleData = JSON.parse(decodeURIComponent(btnPrint.dataset.sale));
                printSale(saleData);
            } catch(err) {
                console.error("Error parsing sale data", err);
            }
        }
        
        if (btnEdit) {
            try {
                const saleData = JSON.parse(decodeURIComponent(btnEdit.dataset.sale));
                
                // Populate Modal for Editing
                saleIdInput.value = saleData.id;
                editingOldSale = saleData;
                
                saleClient.value = saleData.client || '';
                
                if (saleData.paymentMethod === 'QR') {
                    payQrRadio.checked = true;
                    cashPaymentSection.classList.add('d-none');
                    saleAmountPaid.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
                    saleChange.textContent = '0.00';
                } else {
                    payCashRadio.checked = true;
                    cashPaymentSection.classList.remove('d-none');
                    saleAmountPaid.value = saleData.amountPaid || saleData.total;
                    saleChange.textContent = (saleData.change || 0).toFixed(2);
                }
                
                // Reconstruct cart
                currentCart = saleData.items.map(i => ({
                    product: { id: i.productId, codigo: i.codigo, descripcion: i.descripcion, stock: 999 }, // mock stock to allow edit without fresh fetch here
                    qty: i.qty,
                    price: i.price
                }));
                
                updateCartUI();
                
                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('saleModal'));
                modal.show();
                
            } catch(err) {
                console.error("Error parsing sale data for edit", err);
            }
        }
    });
    
    // Clear saleId when opening New Sale modal
    document.querySelector('[data-bs-target="#saleModal"]').addEventListener('click', () => {
        saleIdInput.value = '';
        editingOldSale = null;
        currentCart = [];
        saleClient.value = '';
        saleAmountPaid.value = '';
            if (saleMixedCash) saleMixedCash.value = '';
            if (saleMixedQr) saleMixedQr.value = '';
        saleChange.textContent = '0.00';
        payCashRadio.checked = true;
        cashPaymentSection.classList.remove('d-none');
        updateCartUI();
    });
}

function printSale(sale) {
    const dateObj = new Date(sale.date);
    const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let itemsHtml = '';
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #333;">${item.qty}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333;">
                    <div style="font-weight: 600;">${item.descripcion}</div>
                    <div style="font-size: 0.85em; color: #555;">Cód: ${item.codigo}</div>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; text-align: right;">Bs${item.price.toFixed(2)}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; text-align: right;">Bs${(item.qty * item.price).toFixed(2)}</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Nota de Venta - Repuestos Hamilton</title>
            <style>
                body { 
                    font-family: 'Inter', 'Segoe UI', sans-serif; 
                    padding: 15px; 
                    color: #000; 
                    line-height: 1.5;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end;
                    border-bottom: 4px solid #000;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .logo-area h1 { 
                    margin: 0; 
                    font-size: 32px; 
                    font-weight: 800; 
                    letter-spacing: -1px;
                    text-transform: uppercase;
                }
                .logo-area p {
                    margin: 0;
                    color: #dc3545;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    font-size: 14px;
                }
                .receipt-title {
                    text-align: right;
                }
                .receipt-title h2 {
                    margin: 0;
                    font-size: 24px;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                .receipt-title p {
                    margin: 0;
                    font-size: 14px;
                    color: #555;
                }
                .details-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 15px 30px;
                    margin-bottom: 20px;
                    font-size: 14px;
                    line-height: 1.4;
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 4px;
                }
                .details-list > div {
                    display: flex;
                    flex-direction: column;
                }
                .details-list strong {
                    color: #6c757d;
                    font-size: 11px;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .detail-value {
                    font-weight: 700;
                    font-size: 15px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 20px; 
                }
                th { 
                    text-align: left; 
                    padding: 10px 0; 
                    border-bottom: 2px solid #000; 
                    font-weight: 700; 
                    text-transform: uppercase; 
                    font-size: 12px; 
                    letter-spacing: 1px;
                }
                th.text-right { text-align: right; }
                .totals-area {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .totals-box {
                    width: 350px;
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 4px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    font-size: 14px;
                }
                .total-row.grand-total {
                    font-size: 20px;
                    font-weight: 800;
                    border-top: 2px solid #000;
                    padding-top: 10px;
                    margin-top: 10px;
                    margin-bottom: 0;
                    color: #dc3545;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #555;
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }
                @media print {
                    @page { margin: 0; }
                    body { padding: 0.5cm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-area">
                    <h1>Hamilton</h1>
                    <p>Repuestos & Accesorios</p>
                </div>
                <div class="receipt-title">
                    <h2>Nota de Venta</h2>
                    <p>Copia Cliente</p>
                </div>
            </div>
            
            <div class="details-list">
                <div><strong>CLIENTE:</strong> <span class="detail-value">${sale.client}</span></div>
                <div><strong>FECHA Y HORA:</strong> <span class="detail-value">${dateStr}</span></div>
                <div><strong>VENDEDOR:</strong> <span class="detail-value">${sale.seller || 'No especificado'}</span></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="10%">Cant.</th>
                        <th width="50%">Descripción del Producto</th>
                        <th width="20%" class="text-right">P. Unitario</th>
                        <th width="20%" class="text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="totals-area">
                <div class="totals-box">
                    <div class="total-row">
                        <span>Método de Pago:</span>
                        <strong>${(sale.paymentMethod || 'Efectivo').split('|')[0]}</strong>
                    </div>
                    ${(sale.paymentMethod || 'Efectivo') === 'Efectivo' && sale.amountPaid ? `
                        <div class="total-row" style="color: #6c757d; font-size: 12px; margin-top: 5px;">
                            <span>Efectivo Recibido:</span>
                            <span>Bs${parseFloat(sale.amountPaid).toFixed(2)}</span>
                        </div>
                        <div class="total-row" style="color: #6c757d; font-size: 12px;">
                            <span>Cambio:</span>
                            <span>Bs${parseFloat(sale.change).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${(sale.paymentMethod || '').startsWith('Mixto') ? `
                        <div class="total-row" style="color: #6c757d; font-size: 12px; margin-top: 5px;">
                            <span>Mixto (Efectivo):</span>
                            <span>Bs${parseFloat((sale.paymentMethod.split('|')[1] || 0)).toFixed(2)}</span>
                        </div>
                        <div class="total-row" style="color: #6c757d; font-size: 12px;">
                            <span>Mixto (QR):</span>
                            <span>Bs${parseFloat((sale.paymentMethod.split('|')[2] || 0)).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>TOTAL</span>
                        <span>Bs${sale.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>GRACIAS POR SU COMPRA</p>
                <p>Para reclamos o devoluciones es indispensable presentar este recibo.</p>
            </div>

            <script>
                // Add a small delay to ensure fonts/styles load before print dialog
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
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
    salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary my-3"></div></td></tr>';
    try {
        const { data: salesData, error: salesErr } = await supabase.from('sales').select('*').order('date', { ascending: false });
        if (salesErr) throw salesErr;

        const { data: saleItemsData, error: itemsErr } = await supabase.from('sale_items').select('*');
        if (itemsErr) throw itemsErr;
        
        currentSales = salesData.map(s => {
            const itemsForSale = saleItemsData.filter(si => si.sale_id === s.id);
            return {
                id: s.id,
                client: s.client,
                seller: s.seller_name,
                date: s.date,
                total: s.total,
                paymentMethod: s.payment_method,
                amountPaid: s.amount_paid,
                change: s.change,
                items: itemsForSale.map(si => ({
                    productId: si.product_id,
                    codigo: si.codigo,
                    descripcion: si.descripcion,
                    qty: si.qty,
                    price: si.price
                }))
            };
        });
        
        applySalesFilters();
    } catch (e) {
        console.error("Error loading sales:", e);
        salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar ventas</td></tr>';
    }
}

function renderSalesPage(page) {
    salesCurrentPage = page;
    const startIndex = (page - 1) * salesRowsPerPage;
    const endIndex = startIndex + salesRowsPerPage;
    const paginatedItems = filteredSales.slice(startIndex, endIndex);
    
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
                <button class="btn btn-sm btn-outline-info btn-print-sale rounded-0" data-sale="${encodeURIComponent(JSON.stringify({...sale, id: sale.id}))}" title="Imprimir Nota"><i class="bi bi-printer"></i></button>
                <button class="btn btn-sm btn-outline-primary btn-edit-sale rounded-0 ms-1" data-sale="${encodeURIComponent(JSON.stringify({...sale, id: sale.id}))}" title="Editar Venta"><i class="bi bi-pencil"></i></button>
            </td>
        `;
        salesTableBody.appendChild(tr);
    });
    
    renderSalesPagination();
}

function renderSalesPagination() {
    const totalPages = Math.ceil(filteredSales.length / salesRowsPerPage);
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

function applySalesFilters() {
    const filterStart = document.getElementById('sales-filter-start')?.value;
    const filterEnd = document.getElementById('sales-filter-end')?.value;
    
    filteredSales = currentSales.filter(sale => {
        if (!filterStart && !filterEnd) return true;
        const saleDateLocal = sale.date.split('T')[0];
        
        if (filterStart && saleDateLocal < filterStart) return false;
        if (filterEnd && saleDateLocal > filterEnd) return false;
        return true;
    });
    renderSalesPage(1);
}

function exportSalesToExcel() {
    if (filteredSales.length === 0) {
        alert("No hay ventas para exportar.");
        return;
    }
    const dataToExport = filteredSales.map(sale => {
        const dateObj = new Date(sale.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return {
            "Fecha": dateStr,
            "Cliente": sale.client,
            "Total (Bs)": sale.total,
            "Productos (Cant.)": sale.items.reduce((sum, item) => sum + item.qty, 0)
        };
    });
    
    if (typeof XLSX === 'undefined') {
        alert("La librería para exportar Excel no está cargada.");
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
}

