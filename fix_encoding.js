const fs = require('fs');
const path = require('path');

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const replacements = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã': 'Á',
    'Ã‰': 'É',
    'Ã': 'Í',
    'Ã“': 'Ó',
    'Ãš': 'Ú',
    'Ã±': 'ñ',
    'Ã‘': 'Ñ'
};

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${file}`);
    }
});
