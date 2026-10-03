const fs = require('fs');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
    console.warn("Advertencia: No se encontraron las variables SUPABASE_URL o SUPABASE_KEY.");
}

const content = `import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';\n\nexport const supabase = createClient('${url}', '${key}');\n`;

fs.writeFileSync('./js/supabase-config.js', content, 'utf8');
console.log("✅ Archivo supabase-config.js generado exitosamente para producción.");
