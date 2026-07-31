const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Add search input
html = html.replace('<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">', 
`<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <input type="text" id="hr-search-input" onkeyup="searchHRTable()" placeholder="Tìm tên, mã NV..." style="padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; width: 200px; background: var(--bg-main); color: var(--text-main);">`);

// Add search function
const searchFunc = `
        function searchHRTable() {
            const input = document.getElementById("hr-search-input");
            const filter = input.value.toLowerCase();
            const tbody = document.getElementById("hr-table-body");
            const trs = tbody.getElementsByTagName("tr");
            for (let i = 0; i < trs.length; i++) {
                const tdName = trs[i].getElementsByTagName("td")[1];
                const tdId = trs[i].getElementsByTagName("td")[0];
                if (tdName || tdId) {
                    const txtName = tdName.textContent || tdName.innerText;
                    const txtId = tdId.textContent || tdId.innerText;
                    if (txtName.toLowerCase().indexOf(filter) > -1 || txtId.toLowerCase().indexOf(filter) > -1) {
                        trs[i].style.display = "";
                    } else {
                        trs[i].style.display = "none";
                    }
                }       
            }
        }
        
        function updateDashboard(resetDate = false) {`;

html = html.replace('function updateDashboard(resetDate = false) {', searchFunc);
fs.writeFileSync('index.html', html);
console.log('Search added');
