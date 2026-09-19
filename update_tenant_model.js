const fs = require('fs');
let code = fs.readFileSync('E:/New folder/Master-Server/TEXI/super-admin/backend/src/models/Tenant.js', 'utf8');

const regex = /businessType: \{ type: String, default: 'Taxi Fleet' \},/;
const replacement = `businessType: { type: String, default: 'Taxi Fleet' },
    crmType: { type: String, enum: ['LogKaro Fleet', 'School Management', 'Modified Fleet'], default: 'LogKaro Fleet' },`;

code = code.replace(regex, replacement);
fs.writeFileSync('E:/New folder/Master-Server/TEXI/super-admin/backend/src/models/Tenant.js', code);
console.log('Modified Tenant.js');
