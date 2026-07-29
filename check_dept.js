const fs = require('fs');
const data = fs.readFileSync('data_hr.js', 'utf8');
const depts = new Set();
const regex = /"dept":\s*"([^"]+)"/g;
let match;
while ((match = regex.exec(data)) !== null) {
    depts.add(match[1]);
}
console.log(Array.from(depts));
