const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const https = require('https');

// ==========================================
// CẤU HÌNH DATABASE FIREBASE (DÁN LINK VÀO ĐÂY)
// Ví dụ: https://my-project-default-rtdb.asia-southeast1.firebasedatabase.app
const FIREBASE_DB_URL = "https://check-luong-daily-default-rtdb.firebaseio.com";
// ==========================================

console.log("==============================================");
console.log("TOOL CẬP NHẬT DỮ LIỆU LƯƠNG LÊN HỆ THỐNG");
console.log("==============================================\n");

if (FIREBASE_DB_URL.includes("YOUR-PROJECT-ID")) {
    console.error("❌ LỖI: Bạn chưa cấu hình FIREBASE_DB_URL trong file CapNhatLuong.js");
    console.error("Vui lòng mở file CapNhatLuong.js bằng Notepad và dán link Firebase của bạn vào dòng số 8.\n");
    process.exit(1);
}

// Tìm file excel lương trong thư mục
const files = fs.readdirSync(__dirname);
const excelFiles = files.filter(f => f.endsWith('.xlsx') && (f.toLowerCase().includes('lương') || f.toLowerCase().includes('luong')));

if (excelFiles.length === 0) {
    console.error("❌ LỖI: Không tìm thấy file Excel nào có chữ 'Lương' hoặc 'luong' trong thư mục này!");
    process.exit(1);
}

// Ưu tiên file mới nhất hoặc lấy file đầu tiên (hoặc file lớn nhất)
const targetFile = excelFiles.sort((a,b) => fs.statSync(path.join(__dirname, b)).mtimeMs - fs.statSync(path.join(__dirname, a)).mtimeMs)[0];
console.log(`⏳ Đang đọc file Excel: ${targetFile} (Vui lòng đợi vài giây vì file nặng...)`);

function formatExcelDate(dateCode) {
    if (!dateCode || isNaN(dateCode)) return null;
    const d = xlsx.SSF.parse_date_code(dateCode);
    if (!d) return null;
    const day = String(d.d).padStart(2, '0');
    const month = String(d.m).padStart(2, '0');
    return `${day}/${month}/${d.y}`;
}

try {
    const workbook = xlsx.readFile(path.join(__dirname, targetFile));
    const sheetName = 'Tổng hợp lương';
    
    if (!workbook.Sheets[sheetName]) {
        console.error(`❌ LỖI: File Excel không có sheet mang tên "${sheetName}"!`);
        process.exit(1);
    }

    const sheet = workbook.Sheets[sheetName];
    const rawJson = xlsx.utils.sheet_to_json(sheet, {header: 1});

    // Tìm dòng header
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(20, rawJson.length); i++) {
        const row = rawJson[i];
        if (row && row.includes('ID') && row.includes('Tên') && row.includes('Chi lương')) {
            headerRowIdx = i;
            break;
        }
    }

    if (headerRowIdx === -1) {
        console.error('❌ LỖI: Không tìm thấy dòng tiêu đề (chứa cột ID, Tên, Chi lương) trong sheet!');
        process.exit(1);
    }

    const headers = rawJson[headerRowIdx];
    const colId = headers.indexOf('ID');
    const colName = headers.indexOf('Tên');
    const colTitle = headers.indexOf('Chức danh');
    const colDept = headers.indexOf('Phòng ban');
    const colShift = headers.indexOf('Ca');
    const colSalary = headers.indexOf('Chi lương');
    
    // Tìm các cột chứa ngày phát sinh lương (từ cột Chi Lương + 2 trở đi thường là các ngày)
    // Ví dụ các ngày là dạng số 46174, 46175...
    const dateColumns = [];
    for (let c = 0; c < headers.length; c++) {
        if (typeof headers[c] === 'number' && headers[c] > 40000) {
            const dateStr = formatExcelDate(headers[c]);
            if (dateStr) {
                dateColumns.push({ colIndex: c, dateString: dateStr });
            }
        }
    }

    const salaryObj = {};
    let count = 0;

    for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
        const row = rawJson[i];
        if (!row || row.length === 0 || !row[colId]) continue;

        const idStr = String(row[colId]).trim();
        const deptStr = String(row[colDept] || '').toLowerCase();
        const shiftStr = String(row[colShift] || '').toLowerCase();
        
        // 1. Chỉ lấy Inout Ca 3, Inout Ca 5 và Sort Ca 3
        let isValid = false;
        if (deptStr.includes('in/ out') || deptStr.includes('inout')) {
            if (shiftStr.includes('ca 3') || shiftStr.includes('ca 5') || shiftStr.includes('ca3') || shiftStr.includes('ca5')) {
                isValid = true;
            }
        } else if (deptStr.includes('sort')) {
            if (shiftStr.includes('ca 3') || shiftStr.includes('ca3')) {
                isValid = true;
            }
        }
        
        if (!isValid) continue;

        const salaryAmt = Number(row[colSalary]) || 0;
        if (salaryAmt <= 0) continue; // Loại bỏ những ai có lương = 0

        if (salaryAmt <= 0) continue; // Loại bỏ những ai có lương = 0

        const dailyData = [];
        
        // Lấy chi tiết ngày phát sinh lương
        for (const dCol of dateColumns) {
            const amount = Number(row[dCol.colIndex]) || 0;
            if (amount > 0) {
                dailyData.push({ date: dCol.dateString, amount: amount });
            }
        }

        salaryObj[idStr] = {
            id: idStr,
            name: row[colName] || '',
            title: row[colTitle] || '',
            dept: row[colDept] || '',
            shift: row[colShift] || '',
            salary: salaryAmt,
            pin: '123456', // Sẽ được cập nhật ở bước sau
            dailyDetails: dailyData
        };
        count++;
    }

    console.log(`✅ Đã bóc tách thành công dữ liệu của ${count} nhân sự (Kèm chi tiết ngày công).`);
    console.log(`⏳ Đang tải dữ liệu PIN hiện tại từ hệ thống để tránh ghi đè...`);

    // Gửi yêu cầu GET để lấy danh sách hiện tại
    https.get(`${FIREBASE_DB_URL}/salaryData.json`, (resGet) => {
        let rawData = '';
        resGet.on('data', (chunk) => { rawData += chunk; });
        resGet.on('end', () => {
            let existingData = {};
            try {
                existingData = JSON.parse(rawData) || {};
            } catch(e) {}

            // GHÉP PIN
            for (const id in salaryObj) {
                if (existingData[id] && existingData[id].pin) {
                    salaryObj[id].pin = existingData[id].pin;
                }
            }

            console.log(`⏳ Đang đẩy dữ liệu lên Firebase (Đã bảo toàn mã PIN)...`);
            
            // XUẤT RA FILE LOCAL CHO TRANG QUẢN LÝ
            const jsContent = `// Tự động sinh bởi CapNhatLuong.bat\nwindow.SALARY_DATA = ${JSON.stringify(salaryObj, null, 2)};\n`;
            fs.writeFileSync(path.join(__dirname, 'data_salary.js'), jsContent, 'utf8');

            // Gửi lên Firebase bằng REST API (PUT)
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

            const reqPut = https.request(options, (resPut) => {
                if (resPut.statusCode >= 200 && resPut.statusCode < 300) {
                    console.log(`\n🎉 THÀNH CÔNG! Đã cập nhật xong dữ liệu lương lên hệ thống.`);
                    console.log(`Nhân viên đã có thể vào trang tra cứu để xem lương.\n`);
                } else {
                    console.error(`\n❌ LỖI FIREBASE: HTTP Status ${resPut.statusCode}`);
                }
            });

            reqPut.on('error', (e) => {
                console.error(`\n❌ LỖI MẠNG: Không thể kết nối tới Firebase (${e.message})`);
            });

            reqPut.write(dataString);
            reqPut.end();
        });
    }).on('error', (e) => {
        console.error("Lỗi khi tải dữ liệu PIN:", e.message);
    });

} catch (error) {
    console.error("❌ LỖI HỆ THỐNG:", error.message);
}
