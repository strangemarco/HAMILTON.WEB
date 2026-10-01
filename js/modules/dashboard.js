import { db } from '../firebase-config.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const kpiIngresosHoy = document.getElementById('kpi-ingresos-hoy');
const kpiVentasHoy = document.getElementById('kpi-ventas-hoy');
const kpiProductosVendidos = document.getElementById('kpi-productos-vendidos');
const kpiBajoStock = document.getElementById('kpi-bajo-stock');
const recentSalesTable = document.getElementById('recent-sales-table');

let allSales = [];
let allProducts = [];
let currentFilteredItems = [];

// Charts instances
let salesChartInstance = null;
let topProductsChartInstance = null;

export async function initDashboardView() {
    if (!document.getElementById('salesChart')) return;

    await loadInitialData();
    populateFilters();
    processAndRender();

    // Setup dynamic filters
    const filterInputs = [
        'filter-date-start',
        'filter-date-end',
        'filter-brand',
        'filter-stock',
        'filter-payment'
    ];
    
    filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', processAndRender);
            if (el.tagName === 'INPUT') el.addEventListener('input', processAndRender);
        }
    });

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }
}

async function loadInitialData() {
    try {
        // Fetch products
        const productsSnap = await getDocs(collection(db, "products"));
        allProducts = [];
        productsSnap.forEach(doc => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });

        // Fetch sales
        const salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
        const salesSnap = await getDocs(salesQuery);
        allSales = [];
        salesSnap.forEach(doc => {
            allSales.push({ id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.error("Error loading initial data", e);
    }
}

function populateFilters() {
    const filterBrand = document.getElementById('filter-brand');
    if (!filterBrand) return;

    const brands = new Set();
    allProducts.forEach(p => {
        if (p.marca) brands.add(p.marca);
    });

    filterBrand.innerHTML = '<option value="">Todas</option>';
    brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        filterBrand.appendChild(opt);
    });
}

function processAndRender() {
    const dStart = document.getElementById('filter-date-start').value;
    const dEnd = document.getElementById('filter-date-end').value;
    const filterBrand = document.getElementById('filter-brand').value;
    const filterStock = document.getElementById('filter-stock').value;
    const filterPayment = document.getElementById('filter-payment').value;

    let ingresosHoy = 0;
    const ventasHoySet = new Set();
    let totalProductosVendidos = 0;
    let bajoStock = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days[d.toLocaleDateString()] = 0;
    }

    const productFreq = {};
    currentFilteredItems = [];

    // Count globally low stock for KPI regardless of filters if they want general KPI, 
    // but let's filter it if brand is selected.
    allProducts.forEach(p => {
        let matchBrand = filterBrand ? p.marca === filterBrand : true;
        let matchStock = true;
        if (filterStock === 'bajo') matchStock = p.stock <= 5;
        if (filterStock === 'normal') matchStock = p.stock > 5;

        if (matchBrand && matchStock && p.stock <= 5) {
            bajoStock++;
        }
    });

    allSales.forEach(sale => {
        // Global Sale Filters
        const saleDateObj = new Date(sale.date);
        const dateStr = saleDateObj.toLocaleDateString();

        if (dStart && saleDateObj < new Date(dStart + 'T00:00:00')) return;
        if (dEnd && saleDateObj > new Date(dEnd + 'T23:59:59')) return;
        if (filterPayment && (sale.paymentMethod || 'Efectivo') !== filterPayment) return;

        let saleHasMatchingItems = false;
        let saleTotalFiltered = 0;

        sale.items.forEach(item => {
            // Find product to check brand and stock
            const prod = allProducts.find(p => p.id === item.productId || p.codigo === item.codigo);
            
            // Item Filters
            if (filterBrand && (!prod || prod.marca !== filterBrand)) return;
            if (filterStock) {
                if (!prod) return;
                if (filterStock === 'bajo' && prod.stock > 5) return;
                if (filterStock === 'normal' && prod.stock <= 5) return;
            }

            saleHasMatchingItems = true;
            const subtotal = item.price * item.qty;
            saleTotalFiltered += subtotal;
            totalProductosVendidos += item.qty;

            // Chart data Top 5
            if (!productFreq[item.codigo]) {
                productFreq[item.codigo] = { desc: item.descripcion, qty: 0 };
            }
            productFreq[item.codigo].qty += item.qty;

            // Save for table and excel
            currentFilteredItems.push({
                date: dateStr + ' ' + saleDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                dateRaw: saleDateObj,
                codigo: item.codigo,
                descripcion: item.descripcion,
                marca: prod ? prod.marca : '',
                stockActual: prod ? prod.stock : 0,
                metodoPago: sale.paymentMethod || 'Efectivo',
                qty: item.qty,
                price: item.price,
                totalItem: subtotal,
                client: sale.client
            });
        });

        if (saleHasMatchingItems) {
            // KPIs (Hoy)
            if (sale.date >= todayISO) {
                ingresosHoy += saleTotalFiltered;
                ventasHoySet.add(sale.id);
            }

            // Chart Data (Last 7 Days)
            if (last7Days[dateStr] !== undefined) {
                last7Days[dateStr] += saleTotalFiltered;
            }
        }
    });

    // Sort items by date descending for the table
    currentFilteredItems.sort((a, b) => b.dateRaw - a.dateRaw);

    // Update KPIs
    if (kpiIngresosHoy) kpiIngresosHoy.textContent = `Bs${ingresosHoy.toFixed(2)}`;
    if (kpiVentasHoy) kpiVentasHoy.textContent = ventasHoySet.size;
    if (kpiProductosVendidos) kpiProductosVendidos.textContent = totalProductosVendidos;
    if (kpiBajoStock) kpiBajoStock.textContent = bajoStock;

    renderSalesChart(last7Days);
    renderTopProductsChart(productFreq);
    renderRecentSalesTable(currentFilteredItems.slice(0, 10)); // Show only latest 10 in UI
}

function renderSalesChart(last7Days) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    if (salesChartInstance) salesChartInstance.destroy();

    // Chart.js global defaults for fonts
    Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
    Chart.defaults.color = '#6c757d';

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(last7Days),
            datasets: [{
                label: 'Ingresos por Día (Bs)',
                data: Object.values(last7Days),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.08)',
                borderWidth: 2,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#dc3545',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.1, // Industrial sharp lines
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#212529',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 0
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { borderDash: [4, 4], color: 'rgba(0,0,0,0.05)' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}

function renderTopProductsChart(productFreq) {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;

    if (topProductsChartInstance) topProductsChartInstance.destroy();

    const sorted = Object.keys(productFreq).sort((a, b) => productFreq[b].qty - productFreq[a].qty).slice(0, 5);
    const labels = sorted.map(k => k);
    const data = sorted.map(k => productFreq[k].qty);

    topProductsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#dc3545', // Brand Red
                    '#212529', // Darkest
                    '#343a40', // Dark
                    '#495057', // Medium Dark
                    '#6c757d'  // Muted
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#212529',
                    cornerRadius: 0
                }
            }
        }
    });
}

function renderRecentSalesTable(items) {
    if (!recentSalesTable) return;
    recentSalesTable.innerHTML = '';

    if (items.length === 0) {
        recentSalesTable.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos para los filtros aplicados.</td></tr>';
        return;
    }

    items.forEach(i => {
        recentSalesTable.innerHTML += `
            <tr>
                <td>${i.date}</td>
                <td class="fw-bold">${i.codigo}</td>
                <td>${i.descripcion}</td>
                <td>${i.qty}</td>
                <td class="text-success fw-bold">Bs${i.totalItem.toFixed(2)}</td>
                <td>${i.client}</td>
            </tr>
        `;
    });
}

function exportToExcel() {
    if (currentFilteredItems.length === 0) {
        Swal.fire('Sin datos', 'No hay datos para exportar con los filtros actuales.', 'info');
        return;
    }

    try {
        const dateStr = new Date().toISOString().split('T')[0];
        
        // Define Excel Data Array of Arrays (AOA)
        const aoa = [
            ["REPUESTOS HAMILTON"],
            ["REPORTE DE VENTAS (DASHBOARD)"],
            ["Fecha de Exportación:", dateStr],
            [],
            ["Fecha Transacción", "Cliente", "Método Pago", "Código", "Descripción", "Marca", "Cant. Vendida", "Precio Unitario (Bs)", "Total (Bs)", "Stock Actual"]
        ];
        
        let totalGeneral = 0;

        // Add all rows
        currentFilteredItems.forEach(item => {
            totalGeneral += item.totalItem || 0;
            aoa.push([
                item.date,
                item.client,
                item.metodoPago,
                item.codigo,
                item.descripcion,
                item.marca || '-',
                item.qty,
                item.price,
                item.totalItem,
                item.stockActual
            ]);
        });

        // Add footer/totals
        aoa.push([]);
        aoa.push(["", "", "", "", "", "", "", "TOTAL ACUMULADO:", totalGeneral, ""]);

        // Create workbook and worksheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
        
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
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // A1:J1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }  // A2:J2
        ];

        // Headers
        const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
        cols.forEach(c => {
            if (ws[`${c}5`]) ws[`${c}5`].s = headerRowStyle;
        });

        // Data rows
        for (let r = 5; r < 5 + currentFilteredItems.length; r++) {
            cols.forEach(c => {
                if (ws[`${c}${r+1}`]) {
                    ws[`${c}${r+1}`].s = { border: { top: {style:'thin', color:{auto:1}}, bottom: {style:'thin', color:{auto:1}}, left: {style:'thin', color:{auto:1}}, right: {style:'thin', color:{auto:1}} } };
                    
                    // Currency format for columns H, I
                    if (["H", "I"].includes(c)) {
                        ws[`${c}${r+1}`].s.numFmt = '"Bs "#,##0.00';
                    }
                }
            });
        }

        // Apply styles to total row
        const totalRowIndex = 5 + currentFilteredItems.length + 1;
        if (ws[`H${totalRowIndex}`]) ws[`H${totalRowIndex}`].s = boldStyle;
        if (ws[`I${totalRowIndex}`]) ws[`I${totalRowIndex}`].s = { font: { bold: true }, numFmt: '"Bs "#,##0.00' };

        // Column Widths
        ws['!cols'] = [
            { wch: 15 }, // Fecha
            { wch: 25 }, // Cliente
            { wch: 15 }, // Metodo
            { wch: 20 }, // Codigo
            { wch: 40 }, // Descripcion
            { wch: 15 }, // Marca
            { wch: 15 }, // Qty
            { wch: 20 }, // Precio unit
            { wch: 20 }, // Total Bs
            { wch: 15 }  // Stock
        ];

        XLSX.writeFile(wb, `Reporte_Dashboard_Hamilton_${dateStr}.xlsx`);
    } catch (err) {
        console.error("Error exporting to Excel:", err);
        Swal.fire('Error', 'Hubo un problema al generar el archivo Excel.', 'error');
    }
}
