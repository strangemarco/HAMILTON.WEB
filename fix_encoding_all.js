const fs = require('fs');
const path = require('path');
const dirs = ['.', 'js', 'js/modules'];
const replacements = {
    'á': 'á',
    'é': 'é',
    'í': 'í',
    'ó': 'ó',
    'ú': 'ú',
    'Í': 'Á',
    'É': 'É',
    'Í': 'Í',
    'Ó': 'Ó',
    'Ú': 'Ú',
    'ñ': 'ñ',
    'Ñ': 'Ñ'
};

dirs.forEach(dir => {
    if(!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.html'));
    files.forEach(f => {
        const p = path.join(dir, f);
        let c = fs.readFileSync(p, 'utf8');
        let o = c;
        for (let [k,v] of Object.entries(replacements)) {
            c = c.split(k).join(v);
        }
        if(c !== o) {
            fs.writeFileSync(p, c, 'utf8');
            console.log('Fixed', p);
        }
    });
});
