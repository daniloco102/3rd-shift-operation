const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

console.log("==============================================");
console.log("TOOL CẬP NHẬT DỮ LIỆU NHÂN SỰ KHO TỰ ĐỘNG");
console.log("==============================================\n");

// Tìm file nhân sự trong thư mục
const files = fs.readdirSync(__dirname);
const excelFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~$') && f.toLowerCase().includes('nhan su hcm01'));

if (excelFiles.length === 0) {
    console.error("❌ LỖI: Không tìm thấy file Excel nào có tên chứa 'nhan su hcm01' trong thư mục này!");
    process.exit(1);
}

const targetFile = excelFiles.sort((a,b) => fs.statSync(path.join(__dirname, b)).mtimeMs - fs.statSync(path.join(__dirname, a)).mtimeMs)[0];
console.log(`⏳ Đang đọc file Excel: ${targetFile}...`);

function parseExcelDate(dateVal) {
    if (!dateVal || isNaN(dateVal)) return null;
    return xlsx.SSF.parse_date_code(dateVal);
}

function formatHRDate(d) {
    if (!d) return '';
    return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
}

function calculateDaysWorked(joinDateObj, leaveDateObj) {
    if (!joinDateObj) return { days: 0, months: 0 };
    const start = new Date(joinDateObj.y, joinDateObj.m - 1, joinDateObj.d);
    let end = new Date();
    if (leaveDateObj) {
        end = new Date(leaveDateObj.y, leaveDateObj.m - 1, leaveDateObj.d);
    }
    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return { days, months: months > 0 ? months : 0 };
}

try {
    const workbook = xlsx.readFile(path.join(__dirname, targetFile));
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    let hrActiveData = [];
    let hrResignedData = [];

    rows.forEach(row => {
        const id = row['ID'] || row['Mã NV'] || '';
        const name = row['Tên'] || row['Họ Tên'] || '';
        const dept = String(row['Phòng ban'] || row['Bộ phận'] || '').trim();
        const position = String(row['Chức danh'] || row['Vị trí'] || row['Vị trí/Chức danh'] || row['Chức danh/Vị trí'] || '').trim();
        const shift = String(row['Ca làm việc'] || row['Ca'] || '').trim();
        const joinDateRaw = row['Ngày vào làm'] || row['Ngày vào'];
        const leaveDateRaw = row['Ngày nghỉ việc'] || row['Ngày nghỉ'];
        const leaveReason = String(row['Lý do nghỉ việc?'] || row['Lý do nghỉ việc'] || row['Lý do'] || '').trim();

        if (!id || !name) return;

        const isInout = dept.toLowerCase().includes('in/ out') || dept.toLowerCase().includes('in/out') || dept.toLowerCase().includes('inout');
        const isSort = dept.toLowerCase().includes('sorting') || dept.toLowerCase().includes('sort');
        const caStr = shift.toLowerCase().replace(/\s+/g, '');

        const conditionInout = isInout && (caStr.includes('ca3') || caStr.includes('ca5'));
        const conditionSort = isSort && caStr.includes('ca3');

        if (conditionInout || conditionSort) {
            const joinObj = parseExcelDate(joinDateRaw);
            const leaveObj = parseExcelDate(leaveDateRaw);
            
            const isResigned = !!leaveDateRaw;
            const duration = calculateDaysWorked(joinObj, leaveObj);

            const empInfo = {
                id: id,
                name: name,
                position: position,
                dept: dept,
                shift: shift,
                joinDateStr: formatHRDate(joinObj),
                leaveDateStr: formatHRDate(leaveObj),
                status: isResigned ? 'Đã nghỉ việc' : 'Đang làm việc',
                daysWorked: duration.days,
                monthsWorked: duration.months,
                leaveReason: leaveReason
            };

            if (isResigned) {
                hrResignedData.push(empInfo);
            } else {
                hrActiveData.push(empInfo);
            }
        }
    });

    const exportData = {
        active: hrActiveData,
        resigned: hrResignedData
    };

    const jsContent = `// Tự động sinh bởi CapNhatNhanSu.bat\nwindow.HR_DATA = ${JSON.stringify(exportData, null, 2)};\n`;
    fs.writeFileSync(path.join(__dirname, 'data_hr.js'), jsContent, 'utf8');

    console.log("✅ Đã xử lý thành công! Đã ghi dữ liệu vào file data_hr.js");
    console.log(`📊 Đang làm việc: ${hrActiveData.length} người`);
    console.log(`❌ Đã nghỉ việc: ${hrResignedData.length} người`);
    console.log("👉 Giờ bạn chỉ cần mở file trang web lên là dữ liệu tự động cập nhật!");

} catch (err) {
    console.error("❌ LỖI TRONG QUÁ TRÌNH ĐỌC FILE:");
    console.error(err.message);
    process.exit(1);
}
