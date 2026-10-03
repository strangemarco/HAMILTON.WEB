import { supabase } from '../supabase-config.js';


export async function logAction(action, module, details) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user ? user.email : 'Sistema';
        
        await supabase.from('logs').insert([{
            email: email,
            action: action,
            module: module,
            details: details,
            timestamp: new Date().toISOString()
        }]);
    } catch (e) {
        console.error("Error saving log:", e);
    }
}


