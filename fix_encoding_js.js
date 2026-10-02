const fs = require('fs');
const path = require('path');
const dir = 'js/modules';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const replacements = {'Ã¡':'á','Ã©':'é','Ã­':'í','Ã³':'ó','Ãº':'ú','Ã ':'Á','Ã‰':'É','Ã ':'Í','Ã“':'Ó','Ãš':'Ú','Ã±':'ñ','Ã‘':'Ñ'};
files.forEach(f => {
    const p = path.join(dir, f);
    let c = fs.readFileSync(p, 'utf8');
    let o = c;
    for (let [k,v] of Object.entries(replacements)) c = c.split(k).join(v);
    if(c !== o) {
        fs.writeFileSync(p, c, 'utf8');
        console.log('Fixed', f);
    }
});
