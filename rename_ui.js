const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace('Danh Sách Chi Tiết', 'Dữ Liệu Toàn Bộ Nhân Sự (Danh Sách Chi Tiết)');
html = html.replace('<option value="all">Tất cả tiêu chí</option>', '<option value="all">Toàn bộ nhân sự (Tất cả)</option>');

fs.writeFileSync('index.html', html);
console.log('Replaced successfully');
