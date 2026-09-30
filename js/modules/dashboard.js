import { db } from '../firebase-config.js';
import { collection, getDocs, orderBy, query, where, limit } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const kpiIngresosHoy = document.getElementById('kpi-ingresos-hoy');
const kpiVentasHoy = document.getElementById('kpi-ventas-hoy');
const kpiProductosVendidos = document.getElementById('kpi-productos-vendidos');
const kpiBajoStock = document.getElementById('kpi-bajo-stock');
const recentSalesTable = document.getElementById('recent-sales-table');

export async function initDashboardView() {
    if (!document.getElementById('salesChart')) return; // Only on dashboard.html
    await loadDashboardData();
}

async function loadDashboardData() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // 1. Fetch all sales
        const salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
        const salesSnap = await getDocs(salesQuery);
        
        let ingresosHoy = 0;
        let ventasHoy = 0;
        let totalProductosVendidos = 0;

        // Group sales by day for the chart (last 7 days)
        const last7Days = {};
        for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days[d.toLocaleDateString()] = 0;
        }

        // Product frequencies for top 5 chart
        const productFreq = {};

        // Latest 10 items flattened for the table
        const latestItems = [];

        salesSnap.forEach(doc => {
            const sale = doc.data();
            const saleDate = new Date(sale.date);
            const dateStr = saleDate.toLocaleDateString();

            // KPIs (Hoy)
            if (sale.date >= todayISO) {
                ingresosHoy += sale.total;
                ventasHoy += 1;
            }

            // Chart data
            if (last7Days[dateStr] !== undefined) {
                last7Days[dateStr] += sale.total;
            }

            // Process items inside sale
            sale.items.forEach(item => {
                totalProductosVendidos += item.qty;
                
                // Top products
                if (!productFreq[item.codigo]) {
                    productFreq[item.codigo] = { desc: item.descripcion, qty: 0 };
                }
                productFreq[item.codigo].qty += item.qty;

                // Flatten items for table
                if (latestItems.length < 10) {
                    latestItems.push({
                        date: saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        qty: item.qty,
                        totalItem: item.price * item.qty,
                        client: sale.client
                    });
                }
            });
        });

        // Update KPIs
        if (kpiIngresosHoy) kpiIngresosHoy.textContent = `Bs${ingresosHoy.toFixed(2)}`;
        if (kpiVentasHoy) kpiVentasHoy.textContent = ventasHoy;
        if (kpiProductosVendidos) kpiProductosVendidos.textContent = totalProductosVendidos;

        // 2. Fetch Low Stock Products (<= 5)
        const productsSnap = await getDocs(collection(db, "products"));
        let bajoStock = 0;
        productsSnap.forEach(doc => {
            if (doc.data().stock <= 5) bajoStock++;
        });
        if (kpiBajoStock) kpiBajoStock.textContent = bajoStock;

        // 3. Render Sales Chart (Line)
        renderSalesChart(last7Days);

        // 4. Render Top Products Chart (Doughnut)
        renderTopProductsChart(productFreq);

        // 5. Render Table
        renderRecentSalesTable(latestItems);

    } catch(e) {
        console.error("Error loading dashboard", e);
    }
}

function renderSalesChart(last7Days) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(last7Days),
            datasets: [{
                label: 'Ingresos por Día (Bs)',
                data: Object.values(last7Days),
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTopProductsChart(productFreq) {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;

    const sorted = Object.keys(productFreq).sort((a,b) => productFreq[b].qty - productFreq[a].qty).slice(0, 5);
    const labels = sorted.map(k => k); // Just Codes or Desc
    const data = sorted.map(k => productFreq[k].qty);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderRecentSalesTable(items) {
    if (!recentSalesTable) return;
    recentSalesTable.innerHTML = '';
    
    if (items.length === 0) {
        recentSalesTable.innerHTML = '<tr><td colspan="6" class="text-center">No hay ventas registradas.</td></tr>';
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
