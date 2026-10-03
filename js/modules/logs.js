import { supabase } from '../supabase-config.js';

let allLogs = [];
let currentLogsPage = 1;
const logsPerPage = 10;

export async function initLogsView() {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    
    setupLogs();
    
    try {
        const { data: logs, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(2000);
        if (error) throw error;
        
        allLogs = logs || [];
        
        if (allLogs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay movimientos registrados.</td></tr>';
            document.getElementById('logs-pagination').innerHTML = '';
            return;
        }

        renderLogsPage(1);
    } catch (e) {
        console.error("Error loading logs", e);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar el historial.</td></tr>';
    }
}

function renderLogsPage(page) {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    
    currentLogsPage = page;
    const startIndex = (page - 1) * logsPerPage;
    const endIndex = startIndex + logsPerPage;
    const logsToShow = allLogs.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    logsToShow.forEach(data => {
        const dateObj = new Date(data.timestamp);
        const formattedDate = dateObj.toLocaleDateString('es-BO') + ' ' + dateObj.toLocaleTimeString('es-BO');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted font-monospace"><small>${formattedDate}</small></td>
            <td class="fw-bold">${data.email || 'Sistema'}</td>
            <td><span class="badge bg-secondary rounded-0">${data.module}</span></td>
            <td class="text-primary fw-bold">${data.action}</td>
            <td>${data.details}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    renderLogsPagination();
}

function renderLogsPagination() {
    const paginationContainer = document.getElementById('logs-pagination');
    if (!paginationContainer) return;
    
    const totalPages = Math.ceil(allLogs.length / logsPerPage);
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Prev
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentLogsPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link logs-page-link" href="#" data-page="${currentLogsPage - 1}">Anterior</a>`;
    paginationContainer.appendChild(prevLi);
    
    // Pages
    for (let i = 1; i <= totalPages; i++) {
        // Simple logic for large page counts
        if (i === 1 || i === totalPages || (i >= currentLogsPage - 2 && i <= currentLogsPage + 2)) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentLogsPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link logs-page-link" href="#" data-page="${i}">${i}</a>`;
            paginationContainer.appendChild(li);
        } else if (i === currentLogsPage - 3 || i === currentLogsPage + 3) {
            const li = document.createElement('li');
            li.className = 'page-item disabled';
            li.innerHTML = `<span class="page-link">...</span>`;
            paginationContainer.appendChild(li);
        }
    }
    
    // Next
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentLogsPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link logs-page-link" href="#" data-page="${currentLogsPage + 1}">Siguiente</a>`;
    paginationContainer.appendChild(nextLi);
}

let isLogsSetup = false;
function setupLogs() {
    if (isLogsSetup) return;
    isLogsSetup = true;
    
    const paginationContainer = document.getElementById('logs-pagination');
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.logs-page-link');
            if (link) {
                const page = parseInt(link.dataset.page);
                if (!isNaN(page)) {
                    renderLogsPage(page);
                }
            }
        });
    }
    
    const btnExport = document.getElementById('btn-export-logs');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (allLogs.length === 0) return;
            
            const dateStr = new Date().toISOString().split('T')[0];
            
            const aoa = [
                ["REPUESTOS HAMILTON"],
                ["REGISTRO DE ACTIVIDAD (LOGS)"],
                ["Fecha de reporte:", dateStr],
                [],
                ["Fecha", "Hora", "Usuario", "Módulo", "Acción", "Detalles"]
            ];
            
            allLogs.forEach(log => {
                const dateObj = new Date(log.timestamp);
                aoa.push([
                    dateObj.toLocaleDateString('es-BO'),
                    dateObj.toLocaleTimeString('es-BO'),
                    log.email || 'Sistema',
                    log.module,
                    log.action,
                    log.details
                ]);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Registro de Actividad");
            
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
                { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1
                { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }  // A2:F2
            ];
            
            const cols = ["A", "B", "C", "D", "E", "F"];
            cols.forEach(c => {
                if (ws[`${c}5`]) ws[`${c}5`].s = headerRowStyle;
            });
            
            for (let r = 5; r < 5 + allLogs.length; r++) {
                cols.forEach(c => {
                    if (ws[`${c}${r+1}`]) {
                        ws[`${c}${r+1}`].s = { border: { top: {style:'thin', color:{auto:1}}, bottom: {style:'thin', color:{auto:1}}, left: {style:'thin', color:{auto:1}}, right: {style:'thin', color:{auto:1}} } };
                    }
                });
            }
            
            const wscols = [
                {wch: 12}, // Fecha
                {wch: 10}, // Hora
                {wch: 25}, // Usuario
                {wch: 15}, // Módulo
                {wch: 20}, // Acción
                {wch: 60}  // Detalles
            ];
            ws['!cols'] = wscols;
            
            XLSX.writeFile(wb, "Historial_Actividad.xlsx");
        });
    }
}
