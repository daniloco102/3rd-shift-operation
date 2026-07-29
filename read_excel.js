const xlsx = require('xlsx');

try {
    const workbook = xlsx.readFile('Vận hành ca 3 (Data).xlsx');
    
    const sheetName = 'Target';
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, {header: 1, defval: null});
    
    // Print all rows of Target sheet
    console.log("All rows in Target sheet:");
    data.forEach((row, index) => {
        if (row.some(cell => cell !== null && cell !== '')) {
            console.log(`Row ${index}:`, row);
        }
    });
} catch(err) {
    console.error("Error reading file:", err.message);
}
