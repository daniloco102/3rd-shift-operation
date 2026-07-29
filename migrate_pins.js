const XLSX = require('xlsx');
const https = require('https');

const FIREBASE_DB_URL = "https://check-luong-daily-default-rtdb.firebaseio.com";
const FILE_NAME = "Untitled spreadsheet.xlsx";

try {
    const wb = XLSX.readFile(FILE_NAME);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const salaryObj = {};
    let count = 0;

    data.forEach(row => {
        let idStr = row['MÃ NV'];
        let pinStr = row['MÃ PIN'];
        let nameStr = row['__EMPTY_3'];

        if (idStr && pinStr) {
            idStr = String(idStr).trim();
            // Pad PIN with leading zeros if necessary (Excel sometimes drops them)
            pinStr = String(pinStr).trim();
            while(pinStr.length < 12) {
                pinStr = '0' + pinStr;
            }

            salaryObj[idStr] = {
                id: idStr,
                name: nameStr || '',
                pin: pinStr,
                salary: 0,
                dept: '',
                shift: '',
                dailyDetails: []
            };
            count++;
        }
    });

    console.log(`Đã đọc ${count} tài khoản từ file Excel.`);
    console.log("Đang đẩy lên Firebase...");

    const dataString = JSON.stringify(salaryObj);
    const url = new URL(`${FIREBASE_DB_URL}/salaryData.json`);
    
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataString)
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`🎉 THÀNH CÔNG! Đã đẩy ${count} mã PIN lên Firebase.`);
        } else {
            console.error(`❌ LỖI FIREBASE: HTTP Status ${res.statusCode}`);
        }
    });

    req.on('error', (e) => {
        console.error(`❌ LỖI MẠNG: ${e.message}`);
    });

    req.write(dataString);
    req.end();

} catch (error) {
    console.error("Lỗi:", error);
}
