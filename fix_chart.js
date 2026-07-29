const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const startMarker = 'const deptShiftsOverview = new Set();';
const endMarker = 'hrOverviewChartInstance = new Chart(ctxOverview, {';

const startIndex = html.indexOf(startMarker);
const endIndex = html.indexOf(endMarker);

if (startIndex > -1 && endIndex > -1) {
    const newLogic = `const deptShiftsOverview = new Set();
            const activeDataByDeptShift = {};
            const totalNewData = last4Weeks.map(()=>0);
            const totalResignData = last4Weeks.map(()=>0);
            
            filteredData.forEach(e => {
                if (!isStaff(e.dept)) return; // Bỏ qua Supervisor
                
                const joinW = getWeekNumber(parseDate(e.joinDateStr));
                const leaveW = e.leaveDateStr ? getWeekNumber(parseDate(e.leaveDateStr)) : 9999;
                const label = formatDeptLabel(e.dept, e.shift);
                
                deptShiftsOverview.add(label);
                if (!activeDataByDeptShift[label]) {
                    activeDataByDeptShift[label] = { 'ns': [0,0,0,0], 'gc': [0,0,0,0], 'new': [0,0,0,0], 'resign': [0,0,0,0] };
                }
                
                const dLower = e.dept ? e.dept.toLowerCase() : '';
                const pLower = e.position ? e.position.toLowerCase() : '';
                const isGC = dLower.includes('ctv') || dLower.includes('cồng kềnh') || pLower.includes('ctv') || pLower.includes('cồng kềnh');
                
                last4Weeks.forEach((w, i) => {
                    if (joinW <= w && leaveW > w) activeDataByDeptShift[label][isGC ? 'gc' : 'ns'][i]++;
                    if (joinW === w) {
                        totalNewData[i]++;
                        activeDataByDeptShift[label]['new'][i]++;
                    }
                    if (leaveW === w) {
                        totalResignData[i]++;
                        activeDataByDeptShift[label]['resign'][i]++;
                    }
                });
            });

            // Dữ liệu cho 2 Biểu đồ Grouped Bar (Tuyển mới, Nghỉ việc)
            const deptsResign = new Set();
            const deptsNew = new Set();
            
            filteredData.forEach(e => {
                if (!isStaff(e.dept)) return;
                
                const joinW = getWeekNumber(parseDate(e.joinDateStr));
                const leaveW = e.leaveDateStr ? getWeekNumber(parseDate(e.leaveDateStr)) : 9999;
                const label = formatDeptLabel(e.dept, e.shift);
                
                last4Weeks.forEach((w, i) => {
                    if (joinW === w) deptsNew.add(label);
                    if (leaveW === w) deptsResign.add(label);
                });
            });
            
            const uniqueDeptsNew = Array.from(deptsNew).sort();
            const uniqueDeptsResign = Array.from(deptsResign).sort();
            const chartColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
            
            const datasetsNewGrp = uniqueDeptsNew.map((dept, idx) => ({
                label: dept, data: last4Weeks.map(() => 0),
                backgroundColor: chartColors[idx % chartColors.length], borderRadius: 4
            }));
            const datasetsResignGrp = uniqueDeptsResign.map((dept, idx) => ({
                label: dept, data: last4Weeks.map(() => 0),
                backgroundColor: chartColors[idx % chartColors.length], borderRadius: 4
            }));
            
            filteredData.forEach(e => {
                if (!isStaff(e.dept)) return;
                const joinW = getWeekNumber(parseDate(e.joinDateStr));
                const leaveW = e.leaveDateStr ? getWeekNumber(parseDate(e.leaveDateStr)) : 9999;
                const label = formatDeptLabel(e.dept, e.shift);
                
                const wIdxJoin = last4Weeks.indexOf(joinW);
                if (wIdxJoin > -1) {
                    const dIdx = uniqueDeptsNew.indexOf(label);
                    if (dIdx > -1) datasetsNewGrp[dIdx].data[wIdxJoin]++;
                }
                const wIdxLeave = last4Weeks.indexOf(leaveW);
                if (wIdxLeave > -1) {
                    const dIdx = uniqueDeptsResign.indexOf(label);
                    if (dIdx > -1) datasetsResignGrp[dIdx].data[wIdxLeave]++;
                }
            });

            if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
            
            const ctxOverview = document.getElementById('hrOverviewChart').getContext('2d');
            if (hrOverviewChartInstance) hrOverviewChartInstance.destroy();
            
            const overviewFilter = document.getElementById('hr-overview-filter') ? document.getElementById('hr-overview-filter').value : 'all';
            let allDatasetsOverview = [];
            
            if (overviewFilter === 'all') {
                allDatasetsOverview = [
                    { type: 'line', label: 'Tuyển mới (Tổng)', data: totalNewData, borderColor: '#06b6d4', backgroundColor: '#06b6d4', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 },
                    { type: 'line', label: 'Nghỉ việc (Tổng)', data: totalResignData, borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 }
                ];
                
                let totalNs = [0,0,0,0];
                let totalGc = [0,0,0,0];
                Object.values(activeDataByDeptShift).forEach(v => {
                    for(let i=0; i<4; i++) { totalNs[i]+=v.ns[i]; totalGc[i]+=v.gc[i]; }
                });
                
                if (totalNs.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: 'Tổng Năng Suất', data: totalNs, backgroundColor: '#3b82f6', stack: 'all', yAxisID: 'y' });
                if (totalGc.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: 'Tổng Giờ Công', data: totalGc, backgroundColor: '#93c5fd', stack: 'all', yAxisID: 'y' });
            } else {
                const lbl = overviewFilter;
                if (activeDataByDeptShift[lbl]) {
                    const v = activeDataByDeptShift[lbl];
                    allDatasetsOverview = [
                        { type: 'line', label: \`Tuyển mới (\${lbl})\`, data: v.new, borderColor: '#06b6d4', backgroundColor: '#06b6d4', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 },
                        { type: 'line', label: \`Nghỉ việc (\${lbl})\`, data: v.resign, borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 }
                    ];
                    if (v.ns.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: \`\${lbl} NS\`, data: v.ns, backgroundColor: '#3b82f6', stack: lbl, yAxisID: 'y' });
                    if (v.gc.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: \`\${lbl} GC\`, data: v.gc, backgroundColor: '#93c5fd', stack: lbl, yAxisID: 'y' });
                }
            }
            
            const activeDatasetsOverview = allDatasetsOverview;
            
            `;

    html = html.substring(0, startIndex) + newLogic + html.substring(endIndex);
    fs.writeFileSync('index.html', html, 'utf8');
    console.log("Success");
} else {
    console.log("Markers not found");
}
