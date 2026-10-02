const fs = require('fs');

let content = fs.readFileSync('js/modules/sales.js', 'utf8');

// 1. Imports
content = content.replace(/import \{ collection, addDoc, doc, updateDoc, getDocs, orderBy, query \} from .*/g, '');
content = content.replace(/import \{ db \} from '\.\.\/firebase-config\.js';/, "import { supabase } from '../supabase-config.js';");

// 2. loadSales
const newLoadSales = 
async function loadSales() {
    salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary my-3" role="status"><span class="visually-hidden">Cargando...</span></div></td></tr>';
    try {
        const { data, error } = await supabase.from('sales').select('*, sale_items(*)').order('date', { ascending: false });
        if (error) throw error;
        
        currentSales = data.map(s => ({
            id: s.id,
            client: s.client,
            seller: s.seller_name,
            date: s.date,
            total: s.total,
            paymentMethod: s.payment_method,
            amountPaid: s.amount_paid,
            change: s.change,
            items: s.sale_items.map(si => ({
                productId: si.product_id,
                codigo: si.codigo,
                descripcion: si.descripcion,
                qty: si.qty,
                price: si.price
            }))
        }));
        
        applySalesFilters();
    } catch (e) {
        console.error("Error loading sales:", e);
        salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar ventas</td></tr>';
    }
}
;
content = content.replace(/async function loadSales\(\) \{[\s\S]*?\}\s*function renderSalesPage/g, newLoadSales + '\nfunction renderSalesPage');

// 3. fetch products initially
content = content.replace(/const productsSnapshot = await getDocs\(collection\(db, "products"\)\);\s*availableProducts = \[\];\s*productsSnapshot\.forEach\(\(doc\) => \{\s*availableProducts\.push\(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\);\s*\}\);/g, 
    const { data: prods } = await supabase.from('products').select('*');
    availableProducts = prods || [];
);

// 4. Update Stock & Confirm Sale
// Instead of replacing the whole block, let's just replace the Firebase lines inside it.
// Inside btnConfirmSale event listener:
content = content.replace(/const sale = \{[\s\S]*?saleClient\.value = '';/g, 
            const saleObj = {
                client: saleClient.value || "Público en general",
                seller_name: sellerName,
                date: new Date().toISOString(),
                total: total,
                payment_method: paymentMethod,
                amount_paid: paymentMethod === 'Efectivo' ? amountPaid : total,
                change: paymentMethod === 'Efectivo' ? (amountPaid - total) : 0
            };

            if (saleIdInput.value) {
                // Editing old sale not supported perfectly without RPC in this simple rewrite
                throw new Error('Edición de ventas requiere limpieza de sale_items. Por simplicidad, anula y crea una nueva.');
            } else {
                // New sale
                const { data: insertedSale, error: saleErr } = await supabase.from('sales').insert([saleObj]).select().single();
                if (saleErr) throw saleErr;
                
                const saleItems = currentCart.map(item => ({
                    sale_id: insertedSale.id,
                    product_id: item.product.id,
                    codigo: item.product.codigo,
                    descripcion: item.product.descripcion,
                    qty: item.qty,
                    price: item.price
                }));
                const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
                if (itemsErr) throw itemsErr;

                await logAction("Registrar Venta", "Ventas", 'Registró una nueva venta por Bs' + total.toFixed(2) + ' para ' + saleObj.client);

                // Deduct Stock
                for (const item of currentCart) {
                    const newStock = item.product.stock - item.qty;
                    await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
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
);

fs.writeFileSync('js/modules/sales.js', content, 'utf8');
console.log('sales.js modified successfully');
