const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Add active_only option
html = html.replace('<option value="all">Toàn bộ nhân sự (Tất cả)</option>', '<option value="all">Toàn bộ nhân sự (Tất cả)</option>\n                                    <option value="active_only">Nhân sự đang làm việc</option>');

// 2. Add logic to renderHRDetailTable
const targetLogic = `} else if (selCriteria === 'under_60_days') {`;
const replaceLogic = `} else if (selCriteria === 'active_only') {
                combined = activeList;
            } else if (selCriteria === 'under_60_days') {`;

html = html.replace(targetLogic, replaceLogic);
fs.writeFileSync('index.html', html);
console.log('Added active_only option and logic');
