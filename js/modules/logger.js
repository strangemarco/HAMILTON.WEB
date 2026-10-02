import { supabase } from '../supabase-config.js';


export async function logAction(action, module, details) {
    try {
        const user = auth.currentUser;
        const email = user ? user.email : 'Sistema';
        
        await addDoc(collection(db, "logs"), {
            email: email,
            action: action,
            module: module,
            details: details,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error saving log:", e);
    }
}


