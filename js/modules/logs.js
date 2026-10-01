import { db } from '../firebase-config.js';
import { collection, getDocs, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

export async function initLogsView() {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;

    try {
        const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(100));
        const snapshot = await getDocs(q);
        
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay movimientos registrados.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = new Date(data.timestamp);
            const formattedDate = dateObj.toLocaleDateString('es-BO') + ' ' + dateObj.toLocaleTimeString('es-BO');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-muted"><small>${formattedDate}</small></td>
                <td class="fw-bold">${data.email || 'Sistema'}</td>
                <td><span class="badge bg-secondary rounded-0">${data.module}</span></td>
                <td class="text-primary fw-bold">${data.action}</td>
                <td>${data.details}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading logs", e);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar el historial.</td></tr>';
    }
}
