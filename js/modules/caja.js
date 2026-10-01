import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const cajaDateInput = document.getElementById('caja-date');
const btnLoadCaja = document.getElementById('btn-load-caja');
const btnExportCaja = document.getElementById('btn-export-caja');
const cajaTableBody = document.getElementById('caja-table-body');
const kpiVentas = document.getElementById('kpi-ventas');
const kpiEfectivo = document.getElementById('kpi-efectivo');
const kpiQr = document.getElementById('kpi-qr');
const kpiTotal = document.getElementById('kpi-total');

let currentCajaData = [];
let currentCajaTotals = { efectivo: 0, qr: 0, total: 0 };

export async function initCajaView() {
    if (!cajaTableBody) return;
    
    // Set today's date as default
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
    cajaDateInput.value = localISOTime;

    btnLoadCaja.addEventListener('click', loadCajaData);
    if (btnExportCaja) {
        btnExportCaja.addEventListener('click', exportToExcel);
    }
    
    await loadCajaData();
}

async function loadCajaData() {
    const selectedDate = cajaDateInput.value;
    if (!selectedDate) return;

    btnLoadCaja.disabled = true;
    cajaTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="spinner-border text-primary my-3" role="status"></div>
            </td>
        </tr>
    `;

    try {
        // Since we don't have a direct index for date ranges, we fetch all sales and filter client-side.
        // For a large production app, we would query by date range.
        const q = query(collection(db, "sales"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        
        let countVentas = 0;
        let totalEfectivo = 0;
        let totalQr = 0;
        let totalGeneral = 0;
        
        currentCajaData = [];

        cajaTableBody.innerHTML = '';

        let found = false;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const saleDateLocal = data.date.split('T')[0];
            
            if (saleDateLocal === selectedDate) {
                found = true;
                countVentas++;
                
                const saleTotal = data.total || 0;
                totalGeneral += saleTotal;
                
                if (data.paymentMethod === 'Efectivo') {
                    totalEfectivo += saleTotal;
                } else {
                    totalQr += saleTotal;
                }

                // Format time
                const dateObj = new Date(data.date);
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                currentCajaData.push([
                    timeStr,
                    data.seller || 'Desconocido',
                    data.client || 'Público',
                    data.paymentMethod || 'Efectivo',
                    saleTotal
                ]);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${timeStr}</td>
                    <td>${data.seller || 'Desconocido'}</td>
                    <td>${data.client || 'Público'}</td>
                    <td>
                        <span class="badge ${data.paymentMethod === 'Efectivo' ? 'bg-success' : 'bg-info'}">
                            ${data.paymentMethod || 'Efectivo'}
                        </span>
                    </td>
                    <td class="text-end fw-bold">Bs ${saleTotal.toFixed(2)}</td>
                `;
                cajaTableBody.appendChild(tr);
            }
        });

        if (!found) {
            cajaTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ventas registradas en esta fecha.</td></tr>';
        }

        kpiVentas.textContent = countVentas;
        kpiEfectivo.textContent = totalEfectivo.toFixed(2);
        kpiQr.textContent = totalQr.toFixed(2);
        kpiTotal.textContent = totalGeneral.toFixed(2);
        
        currentCajaTotals = { efectivo: totalEfectivo, qr: totalQr, total: totalGeneral };

    } catch (e) {
        console.error("Error loading caja:", e);
        cajaTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar datos.</td></tr>';
    } finally {
        btnLoadCaja.disabled = false;
    }
}

function exportToExcel() {
    if (currentCajaData.length === 0) {
        Swal.fire('Atención', 'No hay datos para exportar en esta fecha.', 'warning');
        return;
    }
    
    try {
        const dateStr = cajaDateInput.value;
        
        // Define Excel Data Array of Arrays (AOA)
        const aoa = [
            ["REPUESTOS HAMILTON"],
            ["REPORTE DE CIERRE DE CAJA"],
            ["Fecha:", dateStr],
            [],
            ["Hora", "Vendedor", "Cliente", "Método de Pago", "Total (Bs)"]
        ];
        
        // Add all rows
        currentCajaData.forEach(row => aoa.push(row));
        
        // Add footer/totals
        aoa.push([]);
        aoa.push(["", "", "", "Total Efectivo:", currentCajaTotals.efectivo]);
        aoa.push(["", "", "", "Total QR / Transf:", currentCajaTotals.qr]);
        aoa.push(["", "", "", "TOTAL GENERAL:", currentCajaTotals.total]);

        // Create workbook and worksheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cierre de Caja");
        
        // --- STYLING ---
        // Header styling
        const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } }, alignment: { horizontal: "center" } };
        const subtitleStyle = { font: { bold: true, sz: 12 } };
        const boldStyle = { font: { bold: true } };
        const headerRowStyle = { 
            font: { bold: true, color: { rgb: "FFFFFF" } }, 
            fill: { fgColor: { rgb: "343A40" } },
            border: { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }
        };

        // Apply styles to specific cells
        ws["A1"].s = titleStyle;
        ws["A2"].s = subtitleStyle;
        ws["A3"].s = boldStyle;

        // Merge title cells
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // A1:E1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }  // A2:E2
        ];

        // Apply styles to the table headers (Row 5 -> index 4)
        const cols = ["A", "B", "C", "D", "E"];
        cols.forEach(c => {
            if (ws[`${c}5`]) ws[`${c}5`].s = headerRowStyle;
        });

        // Apply styles to totals (last 3 rows)
        const totalRowsStart = 5 + currentCajaData.length + 1;
        for (let i = totalRowsStart; i <= totalRowsStart + 2; i++) {
            if (ws[`D${i}`]) ws[`D${i}`].s = boldStyle;
            if (ws[`E${i}`]) ws[`E${i}`].s = { font: { bold: true }, numFmt: '"Bs "#,##0.00' };
        }
        
        // Data rows borders and number formats
        for (let r = 5; r < 5 + currentCajaData.length; r++) {
            cols.forEach(c => {
                if (ws[`${c}${r+1}`]) {
                    ws[`${c}${r+1}`].s = { border: { top: {style:'thin', color:{auto:1}}, bottom: {style:'thin', color:{auto:1}}, left: {style:'thin', color:{auto:1}}, right: {style:'thin', color:{auto:1}} } };
                    if (c === "E") {
                        ws[`${c}${r+1}`].s.numFmt = '"Bs "#,##0.00';
                    }
                }
            });
        }

        // Column Widths
        ws['!cols'] = [
            { wch: 15 }, // Hora
            { wch: 25 }, // Vendedor
            { wch: 30 }, // Cliente
            { wch: 20 }, // Metodo
            { wch: 15 }  // Total
        ];

        XLSX.writeFile(wb, `Cierre_Caja_${dateStr}.xlsx`);
    } catch (err) {
        console.error("Error exporting to Excel:", err);
        Swal.fire('Error', 'Hubo un problema al generar el archivo Excel.', 'error');
    }
}
