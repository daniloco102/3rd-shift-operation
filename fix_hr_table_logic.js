const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /const tableContainer = document\.getElementById\('hr-table-container'\);\s*if \(tableContainer\) \{\s*if \(selCriteria !== 'all' \|\| selDept !== 'all' \|\| selShift !== 'all'\) \{\s*tableContainer\.style\.display = 'block';\s*renderHRDetailTable\(filteredActive, filteredResigned\);\s*\} else \{\s*tableContainer\.style\.display = 'none';\s*\}\s*\}/;

const replacement = `const tableContainer = document.getElementById('hr-table-container');
            if (tableContainer) {
                tableContainer.style.display = 'block';
                renderHRDetailTable(filteredActive, filteredResigned);
            }`;

if(regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Replaced logic successfully');
} else {
    console.log('Regex did not match for table logic');
}
