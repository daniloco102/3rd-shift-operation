
        // ==========================================
        // CẤU HÌNH FIREBASE 
        // (Đã mở lại kết nối Cloud theo yêu cầu)
        // ==========================================
        const firebaseConfig = {
            apiKey: "AIzaSyBxESuSWcx0FiaSfra2voSQSdCkSk9GgG8",
            authDomain: "check-luong-daily.firebaseapp.com",
            databaseURL: "https://check-luong-daily-default-rtdb.firebaseio.com",
            projectId: "check-luong-daily",
            storageBucket: "check-luong-daily.firebasestorage.app",
            messagingSenderId: "31422532387",
            appId: "1:31422532387:web:05badc76c15aa1cf4f9a96",
            measurementId: "G-2XHR0WXQ2Q"
        };

        let db = null;
        const syncStatusEl = document.getElementById('sync-status');

        if (firebaseConfig.apiKey) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            syncStatusEl.className = 'badge badge-success';
            syncStatusEl.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Đã kết nối Cloud';
        }

        // ==========================================
        // LOGIN LOGIC (Đã bị vô hiệu hóa theo yêu cầu nội bộ)
        // ==========================================
        let currentUser = "Quản lý ca";
        
        function checkLoginState() {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('display-username').innerText = currentUser;
        }
        
        window.logout = function() {
            // Đã vô hiệu hóa đăng xuất
        }

        // ==========================================
        // TABS LOGIC
        // ==========================================
        window.switchTab = function(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
        };



        // ==========================================
        // OPERATIONS DATA (VẬN HÀNH CA 3)
        // ==========================================
        let opsData = { weeks: {} };

        const SUPPLIERS = ["HOA ANH ĐÀO", "VIECCO", "SKT", "THÀNH TÍN", "HOA SEN"];
        const SUPPLIER_COLORS = {
            "HOA ANH ĐÀO": "#f43f5e",
            "VIECCO": "#3b82f6",
            "SKT": "#10b981",
            "THÀNH TÍN": "#f59e0b",
            "HOA SEN": "#8b5cf6"
        };
        
        const FIXED_REQS = {
            "Ca 20:00 - 6:00": { "HOA ANH ĐÀO": 85, "VIECCO": 55, "SKT": 38 },
            "Ca 21:30 - 6:30": { "HOA ANH ĐÀO": 85, "VIECCO": 55, "SKT": 38 },
            "Ca 21:00 - 6:00": { "HOA ANH ĐÀO": 54, "VIECCO": 41, "SKT": 38 }
        };
        
        let records = JSON.parse(localStorage.getItem('freelancer_records_v2')) || [];
        let customShifts = JSON.parse(localStorage.getItem('custom_shifts')) || [];
        let currentHistoryPage = 1;
        const HISTORY_PER_PAGE = 30;

        // Migrate old data if any exists to the new array to avoid clashes (optional, handled gracefully)
        if (records.length === 0) {
            const oldRecords = JSON.parse(localStorage.getItem('freelancer_records'));
            if (oldRecords && oldRecords.length > 0) {
                records = oldRecords;
                localStorage.setItem('freelancer_records_v2', JSON.stringify(records));
            }
        }
        
        // Migrate KIẾN VÀNG -> HOA SEN
        records.forEach(r => {
            if (r.data["KIẾN VÀNG"]) {
                r.data["HOA SEN"] = r.data["KIẾN VÀNG"];
                delete r.data["KIẾN VÀNG"];
            }
        });

        // DOM Elements
        const form = document.getElementById('data-entry-form');
        const tbody = document.getElementById('supplier-input-body');
        const themeToggle = document.getElementById('theme-toggle');
        const historyBody = document.getElementById('history-table-body');

        // Charts references
        let responseRateChart = null;
        let genderPieChart = null;
        let trendLineChart = null;

        document.addEventListener('DOMContentLoaded', () => {
            checkLoginState();
            initTheme();
            loadCustomShifts();
            generateSupplierRows();
            document.getElementById('record-date').valueAsDate = new Date();
            
            if (db) {
                // Listen to Firebase data changes
                loadOpsData(); // Load Operations Data
                db.ref('freelancer_records').on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        records = data;
                        // MIGRATION: Chuyển đổi lv cũ sang lvM/lvF và KIẾN VÀNG sang HOA SEN
                        records.forEach(r => {
                            if (r.data["KIẾN VÀNG"]) {
                                r.data["HOA SEN"] = r.data["KIẾN VÀNG"];
                                delete r.data["KIẾN VÀNG"];
                            }
                            Object.values(r.data).forEach(d => {
                                if (d.lv > 0 && d.lvM === undefined && d.lvF === undefined) {
                                    // Chia tỷ lệ rớt nam/nữ theo tỷ lệ hiện diện
                                    const totalPresent = d.m + d.f;
                                    if (totalPresent > 0) {
                                        d.lvM = Math.round((d.m / totalPresent) * d.lv);
                                        d.lvF = d.lv - d.lvM;
                                    } else {
                                        d.lvM = 0; d.lvF = 0;
                                    }
                                }
                            });
                        });
                        // Backup to local
                        localStorage.setItem('freelancer_records_v2', JSON.stringify(records));
                    } else {
                        // DB rỗng, không làm mất dữ liệu local
                    }
                    updateDashboard();
                });
                
                // Also upload local data to Firebase if Firebase is empty (Migration phase)
                db.ref('freelancer_records').once('value').then(snapshot => {
                    if (!snapshot.exists() && records.length > 0) {
                        saveToCloud();
                    }
                });
            } else {
                updateDashboard();
            }

            document.getElementById('btn-prev-page').addEventListener('click', () => {
                if (currentHistoryPage > 1) {
                    currentHistoryPage--;
                    renderHistoryTable();
                }
            });
            document.getElementById('btn-next-page').addEventListener('click', () => {
                const totalPages = Math.ceil(records.length / HISTORY_PER_PAGE) || 1;
                if (currentHistoryPage < totalPages) {
                    currentHistoryPage++;
                    renderHistoryTable();
                }
            });
        });

        function saveToCloud() {
            // Luôn lưu local trước để chống mất dữ liệu khi F5
            localStorage.setItem('freelancer_records_v2', JSON.stringify(records));
            if(db) {
                db.ref('freelancer_records').set(records).catch(err => {
                    console.error("Lỗi lưu Firebase:", err);
                });
            }
        }

        function loadCustomShifts() {
            const shiftSelect = document.getElementById('record-shift');
            customShifts.forEach(shift => {
                const opt = document.createElement('option');
                opt.value = shift;
                opt.textContent = shift;
                shiftSelect.appendChild(opt);
            });
        }

        document.getElementById('btn-add-shift').addEventListener('click', () => {
            const newShift = prompt('Nhập tên Ca / Khung giờ mới (Ví dụ: Ca 12:00 - 20:00):');
            if(newShift && newShift.trim() !== '') {
                const shiftName = newShift.trim();
                
                // Check if already exists in dropdown
                const shiftSelect = document.getElementById('record-shift');
                let exists = false;
                for(let i=0; i<shiftSelect.options.length; i++) {
                    if(shiftSelect.options[i].value === shiftName) {
                        exists = true;
                        break;
                    }
                }
                
                if(!exists) {
                    customShifts.push(shiftName);
                    localStorage.setItem('custom_shifts', JSON.stringify(customShifts));
                    
                    const opt = document.createElement('option');
                    opt.value = shiftName;
                    opt.textContent = shiftName;
                    shiftSelect.appendChild(opt);
                }
                shiftSelect.value = shiftName;
            }
        });

        function initTheme() {
            const isDark = localStorage.getItem('theme') === 'dark';
            if (isDark) {
                document.documentElement.classList.add('dark');
                themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
            
            themeToggle.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark');
                const darkEnabled = document.documentElement.classList.contains('dark');
                themeToggle.innerHTML = darkEnabled ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('theme', darkEnabled ? 'dark' : 'light');
                updateCharts(); 
            });
        }

        function escapeHTML(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        document.getElementById('is-grouped-shift').addEventListener('change', function() {
            updateFormForShift();
        });

        document.getElementById('record-shift').addEventListener('change', updateFormForShift);
        document.getElementById('record-date').addEventListener('change', updateFormForShift);

        function updateFormForShift() {
            const shift = document.getElementById('record-shift').value;
            const dateStr = document.getElementById('record-date').value;
            let fixedReqs = null;
            
            if (shift === "Ca 20:00 - 6:00" || shift === "Ca 21:30 - 6:30") {
                const siblingShift = shift === "Ca 20:00 - 6:00" ? "Ca 21:30 - 6:30" : "Ca 20:00 - 6:00";
                
                // Kiểm tra xem ca kia (sibling) đã tồn tại trong ngày và đã lấy số yêu cầu chưa?
                let siblingIsMain = false;
                const siblingRec = records.find(r => r.date === dateStr && r.shift === siblingShift);
                if (siblingRec) {
                    const tReq = Object.values(siblingRec.data).reduce((acc, d) => acc + d.req, 0);
                    if (tReq > 0) siblingIsMain = true;
                }
                
                if (siblingIsMain) {
                    fixedReqs = { "HOA ANH ĐÀO": 0, "VIECCO": 0, "SKT": 0 }; // Làm ca phụ
                } else {
                    fixedReqs = { "HOA ANH ĐÀO": 85, "VIECCO": 55, "SKT": 38 }; // Làm ca chính
                }
            } else if (shift === "Ca 21:00 - 6:00") {
                fixedReqs = { "HOA ANH ĐÀO": 54, "VIECCO": 41, "SKT": 38 };
            }

            const isGroupedContainer = document.getElementById('grouped-shift-container');
            const isGroupedCheckbox = document.getElementById('is-grouped-shift');
            
            if (fixedReqs) {
                if (isGroupedContainer) isGroupedContainer.style.display = 'none';
                isGroupedCheckbox.checked = false;
                
                SUPPLIERS.forEach(sup => {
                    const reqInput = document.querySelector(`input[data-supplier="${sup}"][data-field="req"]`);
                    if (reqInput) {
                        reqInput.value = fixedReqs[sup] || 0;
                        reqInput.disabled = true;
                        reqInput.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    }
                });
            } else {
                if (isGroupedContainer) isGroupedContainer.style.display = 'grid';
                
                const isGrouped = isGroupedCheckbox.checked;
                SUPPLIERS.forEach(sup => {
                    const reqInput = document.querySelector(`input[data-supplier="${sup}"][data-field="req"]`);
                    if (reqInput) {
                        if (isGrouped) {
                            reqInput.value = 0;
                            reqInput.disabled = true;
                            reqInput.style.backgroundColor = 'rgba(0,0,0,0.05)';
                        } else {
                            reqInput.disabled = false;
                            reqInput.style.backgroundColor = '';
                        }
                    }
                });
            }
        }

        function generateSupplierRows() {
            tbody.innerHTML = '';
            SUPPLIERS.forEach((sup) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="supplier-name">${sup}</td>
                    <td><input type="number" min="0" data-supplier="${sup}" data-field="req" placeholder="0"></td>
                    <td><input type="number" min="0" data-supplier="${sup}" data-field="res" placeholder="0"></td>
                    <td><input type="number" min="0" data-supplier="${sup}" data-field="m" placeholder="0"></td>
                    <td><input type="number" min="0" data-supplier="${sup}" data-field="f" placeholder="0"></td>
                `;
                tbody.appendChild(tr);
            });
            updateFormForShift();
        }

        // Tự động tính số Nam/Nữ
        tbody.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT') {
                const field = e.target.getAttribute('data-field');
                if(field === 'm' || field === 'f') {
                    const row = e.target.closest('tr');
                    const res = parseInt(row.querySelector('input[data-field="res"]').value) || 0;
                    if(res > 0) {
                        if(field === 'm') {
                            const m = parseInt(e.target.value) || 0;
                            if(m <= res) row.querySelector('input[data-field="f"]').value = res - m;
                        } else {
                            const f = parseInt(e.target.value) || 0;
                            if(f <= res) row.querySelector('input[data-field="m"]').value = res - f;
                        }
                    }
                }
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const dateStr = document.getElementById('record-date').value;
            const shiftStr = document.getElementById('record-shift').value;
            const id = `${dateStr}_${shiftStr}`;
            
            const existingIndex = records.findIndex(r => r.id === id);
            if (existingIndex > -1) {
                if (!confirm(`Dữ liệu cho ${shiftStr} ngày ${dateStr} đã tồn tại. Bạn có muốn ghi đè?`)) return;
            }
            
            const data = {};
            const inputs = document.querySelectorAll('#supplier-input-body input');
            
            inputs.forEach(input => {
                const sup = input.getAttribute('data-supplier');
                const field = input.getAttribute('data-field');
                if (!data[sup]) data[sup] = { req: 0, res: 0, lv: 0, lvM: 0, lvF: 0, m: 0, f: 0 };
                data[sup][field] = parseInt(input.value) || 0;
            });
            
            // Nếu ghi đè, phải giữ lại dữ liệu Xin Về cũ
            if (existingIndex > -1) {
                const oldRec = records[existingIndex];
                for(let sup in data) {
                    if(oldRec.data[sup]) {
                        data[sup].lv = oldRec.data[sup].lv || 0;
                        data[sup].lvM = oldRec.data[sup].lvM || 0;
                        data[sup].lvF = oldRec.data[sup].lvF || 0;
                    }
                }
            }
            
            // VALIDATION: Kiểm tra logic dữ liệu (Đã bỏ check lv > res ở đây vì lv nhập ở form khác)
            let hasError = false;
            let errorMsg = "";
            for (let sup in data) {
                const d = data[sup];
                if (d.res > 0 || d.req > 0) {
                    if (d.res > 0 && (d.m + d.f !== d.res)) {
                        hasError = true;
                        errorMsg = `Lỗi ở Nhà cung cấp ${sup}:\nTổng Nam + Nữ (${d.m + d.f}) phải bằng đúng với "Đáp Ứng" (${d.res}).`;
                        break;
                    }
                }
            }
            if (hasError) {
                alert(errorMsg);
                return; // Ngừng lưu dữ liệu
            }
            
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}`;
            
            const newRecord = { 
                id, 
                date: dateStr, 
                shift: shiftStr, 
                data: data, 
                timestamp: now.getTime(),
                createdBy: existingIndex > -1 ? records[existingIndex].createdBy : (currentUser || "Khách"),
                createdAt: existingIndex > -1 ? records[existingIndex].createdAt : timeStr
            };
            
            if (existingIndex > -1) { records[existingIndex] = newRecord; } 
            else { records.push(newRecord); }
            
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            saveToCloud();
            


            alert('Đã lưu dữ liệu thành công!');
            form.reset();
            document.getElementById('record-date').value = dateStr;
            
            // Trigger checkbox reset visually
            const reqInputs = document.querySelectorAll('input[data-field="req"]');
            reqInputs.forEach(input => { input.disabled = false; input.style.backgroundColor = ''; });
            
            updateDashboard();
        });

        function checkLeaveWarnings() {
            const warningContainer = document.getElementById('warning-container');
            if(!warningContainer) return;
            if(records.length === 0) {
                warningContainer.style.display = 'none';
                return;
            }

            const today = new Date();
            today.setHours(0,0,0,0);
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            
            const leaveCounts = {};
            
            records.forEach(r => {
                const parts = r.date.split('-');
                if(parts.length === 3) {
                    const rDate = new Date(parts[0], parts[1]-1, parts[2]);
                    if(rDate >= sevenDaysAgo && rDate <= today) {
                        if(r.leaveDetails) {
                            r.leaveDetails.forEach(ld => {
                                const key = `${ld.name.toLowerCase().trim()}|${ld.sup}`;
                                if(!leaveCounts[key]) leaveCounts[key] = { name: ld.name, sup: ld.sup, count: 0, dates: [] };
                                leaveCounts[key].count++;
                                leaveCounts[key].dates.push(`${parts[2]}/${parts[1]}`);
                            });
                        }
                    }
                }
            });
            
            const violations = Object.values(leaveCounts).filter(v => v.count >= 2);
            
            if(violations.length > 0) {
                warningContainer.style.display = 'block';
                const listHtml = violations.filter(v => v.count > 2).map(v => `<li style="margin-bottom: 4px;"><strong>${v.name}</strong> (${v.sup}) - Xin về <strong style="color: var(--danger);">${v.count} lần</strong> (các ngày: ${v.dates.join(', ')})</li>`).join('');
                const warningHtml = violations.filter(v => v.count === 2).map(v => `<li style="margin-bottom: 4px;"><strong>${v.name}</strong> (${v.sup}) - Xin về <strong>${v.count} lần</strong> (các ngày: ${v.dates.join(', ')})</li>`).join('');
                
                let html = '';
                if(listHtml) html += `<ul style="margin-left: 20px; color: var(--danger);">` + listHtml + `</ul>`;
                if(warningHtml) html += `<ul style="margin-left: 20px; color: var(--warning); margin-top: 5px;">` + warningHtml + `</ul>`;
                
                document.getElementById('warning-list').innerHTML = html;
            } else {
                warningContainer.style.display = 'none';
            }
        }
        let globalWeekDates = [];
        let globalChartLabels = [];

        function updateDashboard() {
            checkLeaveWarnings();
            updateFilters();
            
            let refDate = new Date();
            const filterDateVal = document.getElementById('chart-filter-date').value;
            if (filterDateVal && filterDateVal !== 'all') {
                const parts = filterDateVal.split('-');
                if(parts.length === 3) refDate = new Date(parts[0], parts[1]-1, parts[2]);
            }
            
            const filterTimeframe = document.getElementById('chart-filter-timeframe') ? document.getElementById('chart-filter-timeframe').value : 'week';
            
            globalWeekDates = [];
            globalChartLabels = [];
            
            if (filterTimeframe === 'day') {
                const yyyy = refDate.getFullYear();
                const mm = String(refDate.getMonth() + 1).padStart(2, '0');
                const dd = String(refDate.getDate()).padStart(2, '0');
                globalWeekDates.push({
                    dateStr: `${yyyy}-${mm}-${dd}`,
                    label: `${dd}/${mm}/${yyyy}`
                });
                globalChartLabels.push(globalWeekDates[0].label);
            } else if (filterTimeframe === 'month') {
                const yyyy = refDate.getFullYear();
                const mm = refDate.getMonth();
                const daysInMonth = new Date(yyyy, mm + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    const dStr = String(i).padStart(2, '0');
                    const mStr = String(mm + 1).padStart(2, '0');
                    globalWeekDates.push({
                        dateStr: `${yyyy}-${mStr}-${dStr}`,
                        label: `${dStr}/${mStr}`
                    });
                    globalChartLabels.push(`${dStr}/${mStr}`);
                }
            } else {
                // week
                const dayOfWeek = refDate.getDay(); 
                const sunday = new Date(refDate);
                sunday.setDate(refDate.getDate() - dayOfWeek);
                for (let i = 0; i < 7; i++) {
                    const d = new Date(sunday);
                    d.setDate(sunday.getDate() + i);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    globalWeekDates.push({
                        dateStr: `${yyyy}-${mm}-${dd}`,
                        label: `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][i]} (${dd}/${mm})`
                    });
                    globalChartLabels.push(globalWeekDates[i].label);
                }
            }

            const timeLabels = document.querySelectorAll('.dynamic-time-label');
            const timeText = filterTimeframe === 'day' ? '(Ngày)' : (filterTimeframe === 'month' ? '(Tháng)' : '(Tuần)');
            timeLabels.forEach(el => {
                const baseText = el.innerText.split('(')[0].trim();
                el.innerText = `${baseText} ${timeText}`;
            });
            const chartTimeLabels = document.querySelectorAll('.chart-time-label');
            const chartTimeText = filterTimeframe === 'day' ? 'Theo Ngày' : (filterTimeframe === 'month' ? 'Theo Tháng' : 'Theo Tuần');
            chartTimeLabels.forEach(el => el.innerText = chartTimeText);

            updateStats();
            updateCharts();
            renderGenderRatioTables();
            renderHistoryTable();
        }

        function updateFilters() {
            const filterDate = document.getElementById('chart-filter-date');
            const filterShift = document.getElementById('chart-filter-shift');
            const filterTimeframe = document.getElementById('chart-filter-timeframe');
            
            if(filterDate.options.length === 0) {
                filterDate.innerHTML = '<option value="all">Tất cả ngày</option>';
                filterShift.innerHTML = '<option value="all">Tất cả ca</option>';
                filterDate.addEventListener('change', updateDashboard);
                filterShift.addEventListener('change', updateDashboard);
                if (filterTimeframe) filterTimeframe.addEventListener('change', updateDashboard);
            }
            
            const currDate = filterDate.value;
            const currShift = filterShift.value;
            
            const uniqueDates = [...new Set(records.map(r => r.date))].sort((a,b) => new Date(b) - new Date(a));
            const uniqueShifts = [...new Set(records.map(r => r.shift))];
            
            let dateHtml = '<option value="all">Tất cả ngày</option>';
            uniqueDates.forEach(d => dateHtml += `<option value="${d}">${formatDate(d)}</option>`);
            filterDate.innerHTML = dateHtml;
            
            let shiftHtml = '<option value="all">Tất cả ca</option>';
            uniqueShifts.forEach(s => shiftHtml += `<option value="${s}">${s}</option>`);
            filterShift.innerHTML = shiftHtml;
            
            if(uniqueDates.includes(currDate)) filterDate.value = currDate;
            if(uniqueShifts.includes(currShift)) filterShift.value = currShift;
        }

        function getFilteredRecords() {
            const s = document.getElementById('chart-filter-shift')?.value || 'all';
            const allowedDates = globalWeekDates.map(wd => wd.dateStr);
            return records.filter(r => {
                if(!allowedDates.includes(r.date)) return false;
                if(s !== 'all' && r.shift !== s) return false;
                return true;
            });
        }

        function updateStats() {
            let tReq = 0, tRes = 0, tLv = 0;
            const filtered = getFilteredRecords();
            filtered.forEach(r => {
                Object.values(r.data).forEach(d => { tReq += d.req; tRes += d.res; tLv += (d.lv || 0); });
            });
            document.getElementById('total-req').innerText = tReq;
            document.getElementById('total-res').innerText = tRes - tLv;
            document.getElementById('total-lv').innerText = tLv;
            const rate = tReq === 0 ? 0 : Math.round(((tRes-tLv)/tReq)*100);
            document.getElementById('avg-rate').innerText = `${rate}%`;
        }

        function updateCharts() {
            const filtered = getFilteredRecords();
            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#f8fafc' : '#1f2937';
            const gridColor = isDark ? '#334155' : '#e5e7eb';
            
            // 0. Base sums for Pie chart (using the `filtered` data)
            let sumM = 0, sumF = 0;
            filtered.forEach(r => {
                SUPPLIERS.forEach(s => {
                    if(r.data[s]) { sumM += r.data[s].m; sumF += r.data[s].f; }
                });
            });

            // 1. Bar Chart Data (Weekly 7 days)
            const weekDates = globalWeekDates;
            const chartLabels = globalChartLabels;
            
            const supplierStats = {};
            weekDates.forEach(wd => {
                supplierStats[wd.dateStr] = {};
                SUPPLIERS.forEach(s => supplierStats[wd.dateStr][s] = {req: 0, res: 0, lv: 0, m: 0, f: 0});
            });
            
            filtered.forEach(r => {
                if (supplierStats[r.date] !== undefined) {
                    SUPPLIERS.forEach(s => {
                        if(r.data[s]) {
                            supplierStats[r.date][s].req += r.data[s].req; 
                            supplierStats[r.date][s].res += r.data[s].res;
                            supplierStats[r.date][s].m += r.data[s].m;
                            supplierStats[r.date][s].f += r.data[s].f;
                            const lv = (r.data[s].lvM || 0) + (r.data[s].lvF || 0);
                            supplierStats[r.date][s].lv += lv;
                        }
                    });
                }
            });
            
            
            const datasets = SUPPLIERS.map(s => {
                const data = weekDates.map(wd => {
                    const st = supplierStats[wd.dateStr][s];
                    const active = st.res - st.lv;
                    if (st.req === 0) return active > 0 ? 100 : 0;
                    return Math.round((active/st.req)*100);
                });
                
                const rawData = weekDates.map(wd => {
                    const st = supplierStats[wd.dateStr][s];
                    return { active: st.res - st.lv, req: st.req };
                });

                return {
                    label: s,
                    data: data,
                    backgroundColor: SUPPLIER_COLORS[s],
                    borderRadius: 4,
                    rawData: rawData
                };
            });
            
            Chart.register(ChartDataLabels);

            if(responseRateChart) responseRateChart.destroy();
            responseRateChart = new Chart(document.getElementById('responseRateChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'bottom', labels: { color: textColor, padding: 15, usePointStyle: true } },
                        tooltip: { 
                            callbacks: { 
                                label: (ctx) => {
                                    const raw = ctx.dataset.rawData[ctx.dataIndex];
                                    return `${ctx.dataset.label}: ${raw.active}/${raw.req} người (${ctx.raw}%)`;
                                }
                            } 
                        },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 10 },
                            formatter: (value, ctx) => {
                                if(value < 5) return ''; 
                                const raw = ctx.dataset.rawData[ctx.dataIndex];
                                return [`${raw.active}`, `(${value}%)`];
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => v + '%' } },
                        x: { grid: { display: false }, ticks: { color: textColor, font: {weight: 'bold'} } }
                    }
                }
            });
            
            

            // 3. Line Chart Data (Trend Over Time - Weekly 7 days)
            const lineDatasets = SUPPLIERS.map(s => {
                return {
                    label: s,
                    data: weekDates.map(wd => {
                        const st = supplierStats[wd.dateStr][s];
                        const active = st.res - st.lv;
                        if (st.req === 0) return active > 0 ? 100 : 0;
                        return Math.round((active/st.req)*100);
                    }),
                    borderColor: SUPPLIER_COLORS[s],
                    backgroundColor: SUPPLIER_COLORS[s],
                    tension: 0.3, // smooth curve
                    borderWidth: 2,
                    pointRadius: 4
                };
            });

            if(trendLineChart) trendLineChart.destroy();
            trendLineChart = new Chart(document.getElementById('trendLineChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: lineDatasets
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: textColor, boxWidth: 12, usePointStyle: true } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => v + '%' } },
                        x: { grid: { color: gridColor }, ticks: { color: textColor } }
                    }
                }
            });

            // 4. Leaving Chart (Số Lượng Xin Về)
            const leaveDatasets = SUPPLIERS.map(s => {
                return {
                    label: s,
                    data: weekDates.map(wd => supplierStats[wd.dateStr][s].lv),
                    backgroundColor: SUPPLIER_COLORS[s],
                    borderRadius: 4
                };
            });
            
            if(window.leaveChartInstance) window.leaveChartInstance.destroy();
            window.leaveChartInstance = new Chart(document.getElementById('leaveChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: leaveDatasets
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'bottom', labels: { color: textColor, padding: 15, usePointStyle: true } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} người` } },
                        datalabels: {
                            color: textColor,
                            anchor: 'end',
                            align: 'top',
                            font: { weight: 'bold', size: 10 },
                            formatter: (value) => value > 0 ? value : ''
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } },
                        x: { grid: { display: false }, ticks: { color: textColor, font: {weight: 'bold'} } }
                    }
                }
            });
        }

        function renderGenderRatioTables() {
            const supplierHeader = document.getElementById('supplier-ratio-header');
            const shiftHeader = document.getElementById('shift-ratio-header');
            const supplierBody = document.getElementById('supplier-ratio-body');
            const shiftBody = document.getElementById('shift-ratio-body');
            if (!supplierBody || !shiftBody) return;

            const filterShiftVal = document.getElementById('chart-filter-shift').value;
            const isAllShift = !filterShiftVal || filterShiftVal === 'all';

            // 1. Build Headers dynamically based on globalChartLabels
            let headHtmlSup = `<tr><th style="text-align: left; min-width: 120px;">NCC</th>`;
            let headHtmlShf = `<tr><th style="text-align: left; min-width: 120px;">Ca Làm Việc</th>`;
            globalChartLabels.forEach(label => {
                const colHtml = `<th style="min-width: 110px;">${label.replace(' ', '<br>')}</th>`;
                headHtmlSup += colHtml;
                headHtmlShf += colHtml;
            });
            headHtmlSup += `</tr>`;
            headHtmlShf += `</tr>`;
            if (supplierHeader) supplierHeader.innerHTML = headHtmlSup;
            if (shiftHeader) shiftHeader.innerHTML = headHtmlShf;

            // 2. Pre-calculate data
            const supData = {};
            SUPPLIERS.forEach(s => {
                supData[s] = {};
                globalWeekDates.forEach(wd => supData[s][wd.dateStr] = {m:0, f:0});
            });

            const shiftSet = new Set();
            records.forEach(r => shiftSet.add(r.shift));
            const allShifts = Array.from(shiftSet).sort();
            const shfData = {};
            allShifts.forEach(sh => {
                shfData[sh] = {};
                globalWeekDates.forEach(wd => shfData[sh][wd.dateStr] = {m:0, f:0});
            });

            records.forEach(r => {
                const rDate = r.date;
                const isMatchShift = isAllShift || r.shift === filterShiftVal;

                // Only process if the record's date is in our current global timeframe
                const wd = globalWeekDates.find(w => w.dateStr === rDate);
                if (!wd) return;

                // Table 1: Supplier
                if (isMatchShift) {
                    SUPPLIERS.forEach(s => {
                        if (r.data[s]) {
                            supData[s][rDate].m += (r.data[s].m || 0);
                            supData[s][rDate].f += (r.data[s].f || 0);
                        }
                    });
                }

                // Table 2: Shift
                if (shfData[r.shift]) {
                    let rM=0, rF=0;
                    Object.values(r.data).forEach(d => { rM += (d.m||0); rF += (d.f||0); });
                    shfData[r.shift][rDate].m += rM;
                    shfData[r.shift][rDate].f += rF;
                }
            });

            function formatGenderCell(m, f) {
                const total = m + f;
                if (total === 0) return '-';
                const mRate = Math.round((m / total) * 100);
                const fRate = 100 - mRate;
                return `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: conic-gradient(#3b82f6 0% ${mRate}%, #ec4899 ${mRate}% 100%); position: relative; flex-shrink: 0;" title="Nam: ${mRate}% | Nữ: ${fRate}%">
                        <div style="position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; background: var(--card-bg); border-radius: 50%;"></div>
                    </div>
                    <div style="text-align: left; line-height: 1.2;">
                        <div style="font-weight: 600; font-size: 0.8rem;">${m}N - ${f}Nữ</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${mRate}% - ${fRate}%</div>
                    </div>
                </div>`;
            }

            let supBodyHtml = '';
            SUPPLIERS.forEach(s => {
                supBodyHtml += `<tr><td style="text-align: left; font-weight: 600; color: ${SUPPLIER_COLORS[s]}">${s}</td>`;
                globalWeekDates.forEach(wd => {
                    supBodyHtml += `<td>${formatGenderCell(supData[s][wd.dateStr].m, supData[s][wd.dateStr].f)}</td>`;
                });
                supBodyHtml += `</tr>`;
            });
            supplierBody.innerHTML = supBodyHtml;

            let shfBodyHtml = '';
            allShifts.forEach(sh => {
                shfBodyHtml += `<tr><td style="text-align: left; font-weight: 600; color: var(--text-color);">${sh}</td>`;
                globalWeekDates.forEach(wd => {
                    shfBodyHtml += `<td>${formatGenderCell(shfData[sh][wd.dateStr].m, shfData[sh][wd.dateStr].f)}</td>`;
                });
                shfBodyHtml += `</tr>`;
            });
            shiftBody.innerHTML = shfBodyHtml;
        }

        function renderHistoryTable() {
            const totalPages = Math.ceil(records.length / HISTORY_PER_PAGE) || 1;
            if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;
            if (currentHistoryPage < 1) currentHistoryPage = 1;
            
            const startIdx = (currentHistoryPage - 1) * HISTORY_PER_PAGE;
            const endIdx = startIdx + HISTORY_PER_PAGE;
            const paginatedRecords = records.slice(startIdx, endIdx);

            const pageInfo = document.getElementById('history-page-info');
            const btnPrev = document.getElementById('btn-prev-page');
            const btnNext = document.getElementById('btn-next-page');
            
            if(pageInfo) pageInfo.innerText = `Trang ${currentHistoryPage} / ${totalPages}`;
            if(btnPrev) {
                btnPrev.disabled = currentHistoryPage === 1;
                btnPrev.style.opacity = currentHistoryPage === 1 ? '0.5' : '1';
                btnPrev.style.cursor = currentHistoryPage === 1 ? 'not-allowed' : 'pointer';
            }
            if(btnNext) {
                btnNext.disabled = currentHistoryPage === totalPages;
                btnNext.style.opacity = currentHistoryPage === totalPages ? '0.5' : '1';
                btnNext.style.cursor = currentHistoryPage === totalPages ? 'not-allowed' : 'pointer';
            }

            historyBody.innerHTML = paginatedRecords.map(r => {
                let tReq = 0, tRes = 0, tLv = 0, tM = 0, tF = 0;
                Object.values(r.data).forEach(d => { tReq += d.req; tRes += d.res; tLv += (d.lv || 0); tM += d.m; tF += d.f; });
                
                let rateHtml = '';
                if(tReq === 0) {
                    rateHtml = `<span class="badge badge-info">(Ca Phụ)</span>`;
                } else {
                    const rate = Math.round(((tRes-tLv)/tReq)*100);
                    let badgeClass = rate >= 100 ? 'badge-success' : (rate >= 80 ? 'badge-warning' : 'badge-danger');
                    rateHtml = `<span class="badge ${badgeClass}">${rate}%</span>`;
                }
                
                let lvStr = '';
                SUPPLIERS.forEach(s => {
                    if(r.data[s] && r.data[s].res > 0) {
                        const d = r.data[s];
                        const lv = (d.lvM||0) + (d.lvF||0);
                        if(lv > 0) {
                            lvStr += `<div style="font-size:0.8rem;">${s}: <strong>${lv}</strong> (${d.lvM||0}N, ${d.lvF||0}Nữ)</div>`;
                        }
                    }
                });
                
                if (r.leaveNote) {
                    lvStr += `<div style="font-size:0.75rem; color: var(--text-muted); margin-top: 6px; font-style: italic; white-space: pre-wrap;"><i class="fa-solid fa-note-sticky"></i> ${r.leaveNote}</div>`;
                }
                
                let auditHtml = '';
                if (r.createdBy) {
                    auditHtml += `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-weight: normal;"><i class="fa-solid fa-user-pen"></i> Nhập: ${r.createdBy} (${r.createdAt || ''})</div>`;
                }
                if (r.updatedBy) {
                    auditHtml += `<div style="font-size: 0.75rem; color: var(--warning); margin-top: 2px; font-weight: normal;"><i class="fa-solid fa-clock-rotate-left"></i> Xin về: ${r.updatedBy} (${r.updatedAt || ''})</div>`;
                }
                
                return `
                    <tr>
                        <td>
                            <strong>${formatDate(r.date)}</strong>
                            ${auditHtml}
                        </td>
                        <td>${r.shift}</td>
                        <td>${tReq}</td>
                        <td>${tRes}</td>
                        <td style="color: var(--danger); font-weight: 600;">${lvStr}</td>
                        <td>${rateHtml}</td>
                        <td>${tM} / ${tF}</td>
                        <td>
                            <button class="btn-theme" onclick="openLeaveModal('${r.id}')" title="Cập nhật Xin Về">
                                <i class="fa-solid fa-person-walking-arrow-right text-warning"></i>
                            </button>
                            <button class="btn-theme" onclick="deleteRecord('${r.id}')" title="Xóa">
                                <i class="fa-solid fa-trash text-danger"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        window.deleteRecord = function(id) {
            if(confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
                records = records.filter(r => r.id !== id);
                saveToCloud();
                updateDashboard(); // Cập nhật giao diện ngay lập tức
            }
        }

        function formatDate(dateStr) {
            const parts = dateStr.split('-');
            if(parts.length !== 3) return dateStr;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        document.getElementById('btn-export-csv').addEventListener('click', () => {
            if(records.length === 0) return alert('Không có dữ liệu để xuất!');
            let csv = '\uFEFFNgày,Ca,Nhà Cung Cấp,Yêu Cầu,Đáp Ứng,Nam Xin Về,Nữ Xin Về,Nam Đáp Ứng,Nữ Đáp Ứng,Tỷ Lệ Đáp Ứng (%),Người Nhập,Thời Gian Nhập,Ghi Chú Xin Về\n';
            records.forEach(r => {
                SUPPLIERS.forEach(s => {
                    if(r.data[s] && r.data[s].req > 0) {
                        const d = r.data[s];
                        const rate = Math.round(((d.res - (d.lvM||0) - (d.lvF||0)) / d.req) * 100);
                        const creator = r.createdBy || '';
                        const createdTime = r.createdAt || '';
                        let noteStr = "";
                        if (r.leaveDetails && r.leaveDetails.length > 0) {
                            noteStr = r.leaveDetails.map(ld => `${ld.name} (${ld.sup} - ${ld.shift} - ${ld.gender==='m'?'Nam':'Nữ'})`).join('; ');
                        } else if (r.leaveNote) {
                            noteStr = r.leaveNote;
                        }
                        const note = noteStr ? `"${noteStr.replace(/"/g, '""')}"` : '';
                        csv += `${formatDate(r.date)},${r.shift},${s},${d.req},${d.res},${d.lvM||0},${d.lvF||0},${d.m},${d.f},${rate}%,${creator},${createdTime},${note}\n`;
                    }
                });
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `freelancer_analytics_${new Date().getTime()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        // MODAL XIN VỀ LOGIC
        let currentLeaveRecord = null;
        let tempLeaveDetails = [];

        window.openLeaveModal = function(id) {
            currentLeaveRecord = records.find(r => r.id === id);
            if(!currentLeaveRecord) return;
            
            document.getElementById('leave-record-id').value = id;
            document.getElementById('leave-modal-title').innerHTML = `<i class="fa-solid fa-person-walking-arrow-right"></i> Danh Sách Xin Về - ${currentLeaveRecord.shift} (${formatDate(currentLeaveRecord.date)})`;
            
            tempLeaveDetails = JSON.parse(JSON.stringify(currentLeaveRecord.leaveDetails || []));
            
            const supSelect = document.getElementById('leaver-sup');
            supSelect.innerHTML = SUPPLIERS.map(s => `<option value="${s}">${s}</option>`).join('');
            
            renderLeaveDetails();
            document.getElementById('leave-modal').classList.add('active');
        };

        window.renderLeaveDetails = function() {
            const tbody = document.getElementById('leave-modal-body');
            tbody.innerHTML = '';
            if(tempLeaveDetails.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 2rem;">Chưa có người nào xin về trong ca này.</td></tr>';
                return;
            }
            tempLeaveDetails.forEach((ld, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${ld.name}</strong></td>
                    <td><span class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-main);">${ld.sup}</span></td>
                    <td>${ld.shift}</td>
                    <td>${ld.gender === 'm' ? 'Nam' : 'Nữ'}</td>
                    <td><button type="button" class="btn-theme" style="color: var(--danger); padding: 4px;" onclick="removeLeaver(${idx})" title="Xóa người này"><i class="fa-solid fa-trash"></i></button></td>
                `;
                tbody.appendChild(tr);
            });
        };

        window.addLeaver = function() {
            const name = document.getElementById('leaver-name').value.trim();
            const sup = document.getElementById('leaver-sup').value;
            const shift = document.getElementById('leaver-shift').value.trim();
            const gender = document.getElementById('leaver-gender').value;

            if(!name || !shift) {
                alert("Vui lòng nhập đầy đủ Họ Tên và Ca làm việc!");
                return;
            }

            // Check warning history
            const today = new Date();
            today.setHours(0,0,0,0);
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            
            let pastCount = 0;
            let pastDates = [];
            records.forEach(r => {
                if(r.id === currentLeaveRecord.id) return; // exclude current editing record
                const parts = r.date.split('-');
                if(parts.length === 3) {
                    const rDate = new Date(parts[0], parts[1]-1, parts[2]);
                    if(rDate >= sevenDaysAgo && rDate <= today) {
                        if(r.leaveDetails) {
                            r.leaveDetails.forEach(ld => {
                                if(ld.name.toLowerCase().trim() === name.toLowerCase().trim() && ld.sup === sup) {
                                    pastCount++;
                                    pastDates.push(`${parts[2]}/${parts[1]}`);
                                }
                            });
                        }
                    }
                }
            });
            
            if(pastCount >= 2) {
                const proceed = confirm(`⚠️ CẢNH BÁO: Freelancer ${name} (${sup}) đã xin về ${pastCount} lần trong 7 ngày qua (vào ngày: ${pastDates.join(', ')}).\n\nBạn có chắc chắn muốn tiếp tục cho người này xin về hôm nay không?`);
                if(!proceed) return;
            }

            const currentCount = tempLeaveDetails.filter(l => l.sup === sup && l.gender === gender).length;
            const maxCount = gender === 'm' ? (currentLeaveRecord.data[sup]?.m || 0) : (currentLeaveRecord.data[sup]?.f || 0);

            if(currentCount >= maxCount) {
                return alert(`Nhà CC ${sup} chỉ có ${maxCount} ${gender === 'm'?'Nam':'Nữ'}, không thể thêm người xin về nữa!`);
            }

            tempLeaveDetails.push({ name, sup, shift, gender });
            
            document.getElementById('leaver-name').value = '';
            document.getElementById('leaver-shift').value = '';
            
            renderLeaveDetails();
        };

        window.removeLeaver = function(idx) {
            tempLeaveDetails.splice(idx, 1);
            renderLeaveDetails();
        };

        window.closeLeaveModal = function() {
            document.getElementById('leave-modal').classList.remove('active');
            currentLeaveRecord = null;
            tempLeaveDetails = [];
        };

        window.saveLeaveData = function() {
            if(!currentLeaveRecord) return;
            const recordIndex = records.findIndex(r => r.id === currentLeaveRecord.id);
            if(recordIndex === -1) return;
            
            SUPPLIERS.forEach(s => {
                if(records[recordIndex].data[s]) {
                    records[recordIndex].data[s].lvM = 0;
                    records[recordIndex].data[s].lvF = 0;
                }
            });

            tempLeaveDetails.forEach(ld => {
                if(records[recordIndex].data[ld.sup]) {
                    if(ld.gender === 'm') records[recordIndex].data[ld.sup].lvM++;
                    else if(ld.gender === 'f') records[recordIndex].data[ld.sup].lvF++;
                }
            });

            SUPPLIERS.forEach(sup => {
                if(records[recordIndex].data[sup]) {
                    const d = records[recordIndex].data[sup];
                    d.lv = (d.lvM || 0) + (d.lvF || 0); 
                }
            });
            
            records[recordIndex].leaveDetails = tempLeaveDetails;
            // Xóa note cũ không cần thiết
            delete records[recordIndex].leaveNote;

            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}`;
            records[recordIndex].updatedBy = currentUser || "Khách";
            records[recordIndex].updatedAt = timeStr;
            
            saveToCloud();
            updateDashboard();
            closeLeaveModal();
        };

        // ==========================================
        // OPERATIONS LOGIC (VẬN HÀNH CA 3) - MANUAL ENTRY
        // ==========================================
        function fillTestW24() {
            document.getElementById('ops-week-name').value = 'W24';
            document.getElementById('ops-start-date').value = '2024-06-10'; // Thứ 2, 10/06/2024
            generateOpsDates();

            // Nhân sự theo docx
            document.getElementById('ops-hr-inout3-ns').value = 83;
            document.getElementById('ops-hr-inout5-ns').value = 62;
            document.getElementById('ops-hr-sort3-ns').value = 37;
            document.getElementById('ops-hr-inout3-gc').value = 0;
            document.getElementById('ops-hr-inout5-gc').value = 1;
            document.getElementById('ops-hr-sort3-gc').value = 3;
            document.getElementById('ops-hr-inout3-new').value = 1;
            document.getElementById('ops-hr-inout5-new').value = 1;
            document.getElementById('ops-hr-sort3-new').value = 0;
            document.getElementById('ops-hr-inout3-quit').value = 3; // (giả sử tổng 3 InOut)
            document.getElementById('ops-hr-inout5-quit').value = 0;
            document.getElementById('ops-hr-sort3-quit').value = 4;
            document.getElementById('ops-hr-inout3-planquit').value = 1;
            document.getElementById('ops-hr-inout5-planquit').value = 0;
            document.getElementById('ops-hr-sort3-planquit').value = 0;
            calcHrTotal();

            // Target theo docx
            document.getElementById('ops-target-sort-xh').value = 0.9;
            document.getElementById('ops-target-inout-xh').value = 0.9;
            document.getElementById('ops-target-sort-nv').value = 4.24;
            document.getElementById('ops-target-inout-nv').value = 4.24;
            document.getElementById('ops-target-sort-kpi').value = 102.4;
            document.getElementById('ops-target-inout-kpi').value = 102.4;
            
            // Random Daily SORT data
            const sortRa = [11020, 10500, 12050, 9800, 10700, 11400, 10100];
            const sortDong = [10500, 10000, 11500, 9500, 10200, 11000, 9700];
            const sortNs = [34.4, 33.8, 38.2, 31.6, 33.4, 36.1, 31.5];
            const sortChiphi = [410, 415, 395, 430, 420, 405, 425];

            // Random Daily INOUT data
            const inoutNhap = [15000, 16200, 15500, 17100, 14900, 16800, 15300];
            const inoutXuat = [14800, 16000, 15300, 17000, 14500, 16500, 15000];
            const inoutNs = [12.9, 14.0, 13.3, 14.7, 12.9, 14.4, 13.3];
            const inoutChiphi = [310, 305, 315, 300, 320, 305, 315];

            for(let i=0; i<7; i++) {
                if(document.getElementById(`sort-ra-${i}`)) document.getElementById(`sort-ra-${i}`).value = sortRa[i];
                if(document.getElementById(`sort-dong-${i}`)) document.getElementById(`sort-dong-${i}`).value = sortDong[i];
                if(document.getElementById(`sort-ns-${i}`)) document.getElementById(`sort-ns-${i}`).value = sortNs[i];
                if(document.getElementById(`sort-chiphi-${i}`)) document.getElementById(`sort-chiphi-${i}`).value = sortChiphi[i];

                if(document.getElementById(`inout-nhap-${i}`)) document.getElementById(`inout-nhap-${i}`).value = inoutNhap[i];
                if(document.getElementById(`inout-xuat-${i}`)) document.getElementById(`inout-xuat-${i}`).value = inoutXuat[i];
                if(document.getElementById(`inout-ns-${i}`)) document.getElementById(`inout-ns-${i}`).value = inoutNs[i];
                if(document.getElementById(`inout-chiphi-${i}`)) document.getElementById(`inout-chiphi-${i}`).value = inoutChiphi[i];
            }
            alert("Đã điền tự động số liệu W24 (Dựa trên báo cáo docx). Bạn hãy cuộn xuống và nhấn 'Lưu Dữ Liệu Vận Hành'!");
        }

        function loadOpsData() {
            if (!db) return;
            db.ref('operations').on('value', snapshot => {
                const data = snapshot.val() || {};
                opsData.weeks = data;
                
                // Cập nhật Select box
                const weekFilter = document.getElementById('ops-dashboard-week');
                const currentVal = weekFilter.value;
                const weeks = Object.keys(data).sort();
                
                if (weeks.length === 0) {
                    weekFilter.innerHTML = '<option value="">-- Chưa có dữ liệu --</option>';
                    document.getElementById('ops-charts-container').style.display = 'none';
                } else {
                    weekFilter.innerHTML = weeks.map(w => `<option value="${w}">${w}</option>`).join('');
                    if (weeks.includes(currentVal)) {
                        weekFilter.value = currentVal;
                    } else {
                        weekFilter.value = weeks[weeks.length - 1]; // Chọn tuần mới nhất
                    }
                    renderOpsDashboard();
                }
            });
        }

        function generateOpsDates() {
            const startDateInput = document.getElementById('ops-start-date').value;
            if (!startDateInput) return;
            
            const startDate = new Date(startDateInput);
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`);
            }

            // Render Header & Body for SORT
            const sortThead = document.getElementById('ops-sort-thead');
            sortThead.innerHTML = `<th>Chỉ số \\ Ngày</th>${dates.map(d => `<th>${d}</th>`).join('')}`;
            
            const sortTbody = document.getElementById('ops-sort-tbody');
            const sortFields = [
                {id: 'ra', label: 'Rã'}, {id: 'dong', label: 'Đóng'}, 
                {id: 'ns', label: 'Năng suất'}, {id: 'chiphi', label: 'Chi phí'}
            ];
            sortTbody.innerHTML = sortFields.map(f => `
                <tr>
                    <td style="font-weight:bold;text-align:left;">${f.label}</td>
                    ${dates.map((d, i) => `<td><input type="number" id="sort-${f.id}-${i}" step="any" style="width:100%;text-align:center;padding:0.4rem;border:1px solid #ddd;border-radius:4px;"></td>`).join('')}
                </tr>
            `).join('');

            // Render Header & Body for INOUT
            const inoutThead = document.getElementById('ops-inout-thead');
            inoutThead.innerHTML = `<th>Chỉ số \\ Ngày</th>${dates.map(d => `<th>${d}</th>`).join('')}`;
            
            const inoutTbody = document.getElementById('ops-inout-tbody');
            const inoutFields = [
                {id: 'nhap', label: 'Nhập'}, {id: 'xuat', label: 'Xuất'}, 
                {id: 'ns', label: 'Năng suất'}, {id: 'chiphi', label: 'Chi phí'}
            ];
            inoutTbody.innerHTML = inoutFields.map(f => `
                <tr>
                    <td style="font-weight:bold;text-align:left;">${f.label}</td>
                    ${dates.map((d, i) => `<td><input type="number" id="inout-${f.id}-${i}" step="any" style="width:100%;text-align:center;padding:0.4rem;border:1px solid #ddd;border-radius:4px;"></td>`).join('')}
                </tr>
            `).join('');
            
            // Tự động load lại nếu tuần này đã có trên Cloud
            const weekName = document.getElementById('ops-week-name').value.trim();
            if(weekName && opsData.weeks[weekName]) {
                fillOpsForm(weekName);
            }
        }

        document.getElementById('ops-form').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!db) return alert("Chưa kết nối Cloud!");
            
            const weekName = document.getElementById('ops-week-name').value.trim();
            const startDate = document.getElementById('ops-start-date').value;
            
            if (!weekName || !startDate) return alert("Vui lòng nhập Tên Tuần và Ngày Bắt Đầu");

            const dates = [];
            const sd = new Date(startDate);
            for (let i = 0; i < 7; i++) {
                const d = new Date(sd);
                d.setDate(d.getDate() + i);
                dates.push(`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`);
            }
            
            // Thu thập SORT
            const sort = { dates, ra: [], dong: [], gcong: [], ns: [], chiphi: [] };
            // Thu thập INOUT
            const inout = { dates, nhap: [], xuat: [], gcong: [], ns: [], chiphi: [] };
            
            for(let i=0; i<7; i++) {
                sort.ra.push(Number(document.getElementById(`sort-ra-${i}`)?.value) || null);
                sort.dong.push(Number(document.getElementById(`sort-dong-${i}`)?.value) || null);
                sort.gcong.push(Number(document.getElementById(`sort-gcong-${i}`)?.value) || null);
                sort.ns.push(Number(document.getElementById(`sort-ns-${i}`)?.value) || null);
                sort.chiphi.push(Number(document.getElementById(`sort-chiphi-${i}`)?.value) || null);

                inout.nhap.push(Number(document.getElementById(`inout-nhap-${i}`)?.value) || null);
                inout.xuat.push(Number(document.getElementById(`inout-xuat-${i}`)?.value) || null);
                inout.gcong.push(Number(document.getElementById(`inout-gcong-${i}`)?.value) || null);
                inout.ns.push(Number(document.getElementById(`inout-ns-${i}`)?.value) || null);
                inout.chiphi.push(Number(document.getElementById(`inout-chiphi-${i}`)?.value) || null);
            }

            // Thu thập Target
            const targetMetrics = {
                sort: {
                    vol: Number(document.getElementById('ops-target-sort-vol').value) || null,
                    cost: Number(document.getElementById('ops-target-sort-cost').value) || null,
                    ns: Number(document.getElementById('ops-target-sort-ns').value) || null,
                    xh: Number(document.getElementById('ops-target-sort-xh').value) || null,
                    nv: Number(document.getElementById('ops-target-sort-nv').value) || null,
                    kpi: Number(document.getElementById('ops-target-sort-kpi').value) || null,
                },
                inout: {
                    vol: Number(document.getElementById('ops-target-inout-vol').value) || null,
                    cost: Number(document.getElementById('ops-target-inout-cost').value) || null,
                    ns: Number(document.getElementById('ops-target-inout-ns').value) || null,
                    xh: Number(document.getElementById('ops-target-inout-xh').value) || null,
                    nv: Number(document.getElementById('ops-target-inout-nv').value) || null,
                    kpi: Number(document.getElementById('ops-target-inout-kpi').value) || null,
                }
            };

            const personnel = {
                inout3: {
                    ns: Number(document.getElementById('ops-hr-inout3-ns').value) || 0,
                    gc: Number(document.getElementById('ops-hr-inout3-gc').value) || 0,
                    newH: Number(document.getElementById('ops-hr-inout3-new').value) || 0,
                    quit: Number(document.getElementById('ops-hr-inout3-quit').value) || 0,
                    planquit: Number(document.getElementById('ops-hr-inout3-planquit').value) || 0,
                },
                inout5: {
                    ns: Number(document.getElementById('ops-hr-inout5-ns').value) || 0,
                    gc: Number(document.getElementById('ops-hr-inout5-gc').value) || 0,
                    newH: Number(document.getElementById('ops-hr-inout5-new').value) || 0,
                    quit: Number(document.getElementById('ops-hr-inout5-quit').value) || 0,
                    planquit: Number(document.getElementById('ops-hr-inout5-planquit').value) || 0,
                },
                sort3: {
                    ns: Number(document.getElementById('ops-hr-sort3-ns').value) || 0,
                    gc: Number(document.getElementById('ops-hr-sort3-gc').value) || 0,
                    newH: Number(document.getElementById('ops-hr-sort3-new').value) || 0,
                    quit: Number(document.getElementById('ops-hr-sort3-quit').value) || 0,
                    planquit: Number(document.getElementById('ops-hr-sort3-planquit').value) || 0,
                }
            };

            const dataToSave = {
                startDate,
                sort,
                inout,
                targetMetrics,
                personnel,
                updatedAt: new Date().toISOString()
            };

            db.ref(`operations/${weekName}`).set(dataToSave)
                .then(() => {
                    alert("Lưu dữ liệu Vận Hành thành công!");
                })
                .catch(err => alert("Lỗi lưu dữ liệu: " + err.message));
        });

        function fillOpsForm(weekName) {
            const data = opsData.weeks[weekName];
            if(!data) return;
            
            // Fill target
            if(data.targetMetrics) {
                document.getElementById('ops-target-sort-vol').value = data.targetMetrics.sort.vol || '';
                document.getElementById('ops-target-sort-cost').value = data.targetMetrics.sort.cost || '';
                document.getElementById('ops-target-sort-ns').value = data.targetMetrics.sort.ns || '';
                document.getElementById('ops-target-sort-xh').value = data.targetMetrics.sort.xh || '';
                document.getElementById('ops-target-sort-nv').value = data.targetMetrics.sort.nv || '';
                document.getElementById('ops-target-sort-kpi').value = data.targetMetrics.sort.kpi || '';

                document.getElementById('ops-target-inout-vol').value = data.targetMetrics.inout.vol || '';
                document.getElementById('ops-target-inout-cost').value = data.targetMetrics.inout.cost || '';
                document.getElementById('ops-target-inout-ns').value = data.targetMetrics.inout.ns || '';
                document.getElementById('ops-target-inout-xh').value = data.targetMetrics.inout.xh || '';
                document.getElementById('ops-target-inout-nv').value = data.targetMetrics.inout.nv || '';
                document.getElementById('ops-target-inout-kpi').value = data.targetMetrics.inout.kpi || '';
            }

            // Fill personnel

            // Fill HR Data
            if(data.personnel) {
                const deps = ['inout3', 'inout5', 'sort3'];
                deps.forEach(dep => {
                    const p = data.personnel[dep];
                    if (p && typeof p === 'object') {
                        if(document.getElementById(`ops-hr-${dep}-ns`)) document.getElementById(`ops-hr-${dep}-ns`).value = p.ns || '';
                        if(document.getElementById(`ops-hr-${dep}-gc`)) document.getElementById(`ops-hr-${dep}-gc`).value = p.gc || '';
                        if(document.getElementById(`ops-hr-${dep}-new`)) document.getElementById(`ops-hr-${dep}-new`).value = p.newH || '';
                        if(document.getElementById(`ops-hr-${dep}-quit`)) document.getElementById(`ops-hr-${dep}-quit`).value = p.quit || '';
                        if(document.getElementById(`ops-hr-${dep}-planquit`)) document.getElementById(`ops-hr-${dep}-planquit`).value = p.planquit || '';
                    } else if (p) {
                        if(document.getElementById(`ops-hr-${dep}-ns`)) document.getElementById(`ops-hr-${dep}-ns`).value = p;
                    }
                });
                calcHrTotal();
            }
            
            // Fill daily
            if(data.sort && data.sort.dates) {
                for(let i=0; i<7; i++) {
                    if(document.getElementById(`sort-ra-${i}`)) document.getElementById(`sort-ra-${i}`).value = data.sort.ra[i] || '';
                    if(document.getElementById(`sort-dong-${i}`)) document.getElementById(`sort-dong-${i}`).value = data.sort.dong[i] || '';
                    if(document.getElementById(`sort-ns-${i}`)) document.getElementById(`sort-ns-${i}`).value = data.sort.ns[i] || '';
                    if(document.getElementById(`sort-chiphi-${i}`)) document.getElementById(`sort-chiphi-${i}`).value = data.sort.chiphi[i] || '';

                    if(document.getElementById(`inout-nhap-${i}`)) document.getElementById(`inout-nhap-${i}`).value = data.inout.nhap[i] || '';
                    if(document.getElementById(`inout-xuat-${i}`)) document.getElementById(`inout-xuat-${i}`).value = data.inout.xuat[i] || '';
                    if(document.getElementById(`inout-ns-${i}`)) document.getElementById(`inout-ns-${i}`).value = data.inout.ns[i] || '';
                    if(document.getElementById(`inout-chiphi-${i}`)) document.getElementById(`inout-chiphi-${i}`).value = data.inout.chiphi[i] || '';
                }
            }
        }

        // Dashboard logic sẽ được build bằng Chart.js
        function renderOpsDashboard() {
            const week = document.getElementById('ops-dashboard-week').value;
            if(!week || !opsData.weeks[week]) {
                document.getElementById('ops-charts-container').style.display = 'none';
                return;
            }
            document.getElementById('ops-charts-container').style.display = 'flex';
            
            const data = opsData.weeks[week];
            
            // Populate HR Data
            if (data.personnel) {
                const deps = ['inout3', 'inout5', 'sort3'];
                deps.forEach(dep => {
                    const p = data.personnel[dep];
                    if (p && typeof p === 'object') {
                        document.getElementById(`ops-dash-hr-${dep}-total`).innerText = (p.ns || 0) + (p.gc || 0);
                        document.getElementById(`ops-dash-hr-${dep}-ns`).innerText = p.ns || 0;
                        document.getElementById(`ops-dash-hr-${dep}-gc`).innerText = p.gc || 0;
                        document.getElementById(`ops-dash-hr-${dep}-new`).innerText = p.newH || 0;
                        document.getElementById(`ops-dash-hr-${dep}-quit`).innerText = p.quit || 0;
                        document.getElementById(`ops-dash-hr-${dep}-planquit`).innerText = p.planquit || 0;
                    } else if (p) {
                        document.getElementById(`ops-dash-hr-${dep}-total`).innerText = p;
                        document.getElementById(`ops-dash-hr-${dep}-ns`).innerText = p;
                    }
                });
                generateHrAnalysis(data.personnel);
            } else {
                ['inout3', 'inout5', 'sort3'].forEach(dep => {
                    document.getElementById(`ops-dash-hr-${dep}-total`).innerText = 0;
                    document.getElementById(`ops-dash-hr-${dep}-ns`).innerText = 0;
                    document.getElementById(`ops-dash-hr-${dep}-gc`).innerText = 0;
                    document.getElementById(`ops-dash-hr-${dep}-new`).innerText = 0;
                    document.getElementById(`ops-dash-hr-${dep}-quit`).innerText = 0;
                    document.getElementById(`ops-dash-hr-${dep}-planquit`).innerText = 0;
                });
                document.getElementById('ops-hr-analysis-content').innerHTML = "Chưa có dữ liệu nhân sự để phân tích.";
            }
            
            // Draw Chart for SORT
            drawOpsChart('opsSortChart', 'NĂNG SUẤT THEO CA SORT', data.sort, 
                {bar1: 'Rã', bar2: 'Đóng', c1: '#4CAF50', c2: '#42a5f5'});
            
            // Draw Chart for INOUT
            drawOpsChart('opsInoutChart', 'NĂNG SUẤT THEO CA INOUT', data.inout, 
                {bar1: 'Nhập', bar2: 'Xuất', c1: '#42a5f5', c2: '#4CAF50'});
            
            // Draw Target Comparison Tables
            renderTargetComparisonTable(week);
        }

        function generateHrAnalysis(personnel) {
            let totalHr = 0;
            let totalQuit = 0;
            let totalNew = 0;
            let totalPlanQuit = 0;
            
            const deps = ['inout3', 'inout5', 'sort3'];
            deps.forEach(dep => {
                const p = personnel[dep] || {};
                const t = (p.ns || 0) + (p.gc || 0);
                totalHr += t;
                totalQuit += p.quit || 0;
                totalNew += p.newH || 0;
                totalPlanQuit += p.planquit || 0;
            });
            
            let analysis = `<p><strong>Tổng quan:</strong> Tuần này vận hành với tổng số <strong>${totalHr}</strong> nhân sự.</p>`;
            
            if (totalQuit > 0) {
                const quitRate = ((totalQuit / (totalHr + totalQuit)) * 100).toFixed(1);
                analysis += `<p><strong>Biến động:</strong> Có <strong style="color:var(--danger)">${totalQuit}</strong> nhân sự nghỉ việc, chiếm <strong>${quitRate}%</strong>. `;
                if (quitRate > 4) {
                    analysis += `<span style="color:var(--danger);">Đây là mức biến động tương đối cao, cần rà soát lại nguyên nhân và có phương án giữ chân nhân sự.</span>`;
                } else {
                    analysis += `Tỷ lệ biến động nhân sự ở mức ổn định dưới 4%.`;
                }
                analysis += `</p>`;
            }
            
            if (totalNew > 0) {
                analysis += `<p><strong>Tuyển dụng bù đắp:</strong> Đã tuyển mới <strong>${totalNew}</strong> nhân sự. `;
                if (totalNew < totalQuit) {
                    analysis += `<span style="color:var(--warning);">Tốc độ bù đắp vẫn đang chậm hơn tốc độ nghỉ việc (${totalNew}/${totalQuit}), có nguy cơ thiếu hụt nhân sự trong tuần tiếp theo nếu sản lượng tăng.</span></p>`;
                } else {
                    analysis += `<span style="color:var(--success);">Tốc độ tuyển mới đảm bảo bù đắp đủ lượng nhân sự hao hụt.</span></p>`;
                }
            }
            
            if (totalPlanQuit > 0) {
                analysis += `<p><strong>Cảnh báo tương lai:</strong> Đã ghi nhận <strong>${totalPlanQuit}</strong> trường hợp dự kiến nghỉ. Cần báo ngay cho bộ phận Tuyển dụng chuẩn bị trước nguồn lực thay thế để tránh gãy ca.</p>`;
            }
            
            if (totalQuit === 0 && totalPlanQuit === 0) {
                analysis += `<p><strong>Kết luận:</strong> Tình hình nhân sự cực kỳ ổn định, không có biến động bất lợi nào.</p>`;
            }
            
            document.getElementById('ops-hr-analysis-content').innerHTML = analysis;
        }

        let opsCharts = {};

        function drawOpsChart(canvasId, title, data, config) {
            if (typeof ChartDataLabels !== 'undefined') {
                Chart.register(ChartDataLabels);
            }

            const ctx = document.getElementById(canvasId).getContext('2d');
            if(opsCharts[canvasId]) {
                opsCharts[canvasId].destroy();
            }

            const dates = data.dates || [];
            const bar1Data = data.ra || data.nhap || [];
            const bar2Data = data.dong || data.xuat || [];
            const nsData = data.ns || [];
            const costData = data.chiphi || [];

            opsCharts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            type: 'line',
                            label: 'Năng suất',
                            data: nsData,
                            borderColor: '#F44336',
                            backgroundColor: '#F44336',
                            borderWidth: 2,
                            yAxisID: 'y1',
                            pointStyle: 'rect',
                            pointRadius: 5
                        },
                        {
                            type: 'line',
                            label: 'Chi phí',
                            data: costData,
                            borderColor: '#FF9800',
                            backgroundColor: '#FF9800',
                            borderWidth: 2,
                            yAxisID: 'y1',
                            pointStyle: 'triangle',
                            pointRadius: 6
                        },
                        {
                            type: 'bar',
                            label: config.bar1,
                            data: bar1Data,
                            backgroundColor: config.c1,
                            yAxisID: 'y'
                        },
                        {
                            type: 'bar',
                            label: config.bar2,
                            data: bar2Data,
                            backgroundColor: config.c2,
                            yAxisID: 'y'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Sản lượng' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: 'Năng suất / Chi phí' }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: false },
                        datalabels: {
                            color: '#ffffff',
                            backgroundColor: (ctx) => ctx.dataset.type === 'line' ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                            textStrokeColor: (ctx) => ctx.dataset.type === 'bar' ? 'rgba(0,0,0,0.6)' : 'transparent',
                            textStrokeWidth: (ctx) => ctx.dataset.type === 'bar' ? 3 : 0,
                            borderRadius: 4,
                            padding: 4,
                            font: { weight: 'bold', size: 11 },
                            anchor: 'center',
                            align: (ctx) => {
                                if (ctx.dataset.type === 'bar') return 'center';
                                return ctx.datasetIndex === 0 ? 'top' : 'bottom';
                            },
                            offset: (ctx) => ctx.dataset.type === 'line' ? 6 : 0,
                            formatter: (value) => value > 0 ? value : ''
                        }
                    }
                }
            });
        }

        function renderTargetComparisonTable(week) {
            // Mặc định sort chuỗi sẽ làm '25' đứng trước 'Tuần 24', nên ta phải sort theo số
            const sortedWeeks = Object.keys(opsData.weeks).sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.replace(/\D/g, '')) || 0;
                return numA - numB;
            });
            const currIdx = sortedWeeks.indexOf(week);
            const prevWeek = currIdx > 0 ? sortedWeeks[currIdx - 1] : null;
            
            const currData = opsData.weeks[week].targetMetrics || {};
            const prevData = prevWeek ? (opsData.weeks[prevWeek].targetMetrics || {}) : {};

            const targetFixed = {
                vol: null, cost: 475, ns: null, xh: 0.9, nv: 5, kpi: null
            }; // 0.9 = 0.9%, 5 = 5%

            const metrics = [
                {id: 'vol', label: 'Volume (DRNX/4)'},
                {id: 'cost', label: 'Chi phí cost/đơn'},
                {id: 'ns', label: 'Năng suất (DRNX/4)'},
                {id: 'xh', label: 'Tỉ lệ xuất hàng > 24%'},
                {id: 'nv', label: 'Tỷ lệ nghỉ việc'},
                {id: 'kpi', label: 'KPI đạt được'}
            ];

            const renderRow = (m, type) => {
                const cVal = currData[type]?.[m.id] || 0;
                const pVal = prevData[type]?.[m.id] || 0;
                const diff = cVal - pVal;
                const diffStr = diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff);
                const diffColor = diff < 0 ? 'color:var(--danger);' : '';

                let targetVal = targetFixed[m.id];
                let targetStr = targetVal === null ? 'Không có' : targetVal;
                if(m.id === 'xh' || m.id === 'nv') targetStr += '%';

                let compareTarget = 'Không có';
                if(targetVal !== null && targetVal !== 0) {
                    let ratio = 0;
                    if (m.id === 'cost' || m.id === 'xh' || m.id === 'nv') {
                        ratio = 200 - ((cVal / targetVal) * 100);
                    } else {
                        ratio = (cVal / targetVal) * 100;
                    }

                    if (ratio > 120) ratio = 120;
                    if (ratio < 50) ratio = 50;
                    
                    if (ratio === 120) {
                        compareTarget = `<span style="color:var(--success); text-decoration: underline; text-decoration-style: double; text-decoration-color: var(--success);">120.00%</span>`;
                    } else if (ratio >= 100) {
                        compareTarget = `<span style="color:var(--success);">${ratio.toFixed(2)}%</span>`;
                    } else if (ratio >= 80) {
                        compareTarget = `<span style="color:var(--warning);">${ratio.toFixed(2)}%</span>`;
                    } else {
                        compareTarget = `<span style="color:var(--danger);">${ratio.toFixed(2)}%</span>`;
                    }
                }

                if(m.id === 'kpi') {
                    // special row
                    let kpiVal = cVal;
                    if (kpiVal > 120) kpiVal = 120;
                    if (kpiVal < 50) kpiVal = 50;
                    
                    let kpiHtml = '';
                    if (kpiVal === 120) {
                        kpiHtml = `<span style="color:var(--success); text-decoration: underline; text-decoration-style: double; text-decoration-color: var(--success);">120%</span>`;
                    } else if (kpiVal >= 100) {
                        kpiHtml = `<span style="color:var(--success);">${kpiVal}%</span>`;
                    } else if (kpiVal >= 80) {
                        kpiHtml = `<span style="color:var(--warning);">${kpiVal}%</span>`;
                    } else {
                        kpiHtml = `<span style="color:var(--danger);">${kpiVal}%</span>`;
                    }

                    return `<tr>
                        <td colspan="4" style="font-weight:bold;text-align:center;">KPI đạt được</td>
                        <td colspan="3" style="font-weight:bold;text-align:center;">${kpiHtml}</td>
                    </tr>`;
                }

                return `<tr>
                    <td style="font-weight:600; text-align:left;">${m.label}</td>
                    <td>Ca 3</td>
                    <td>${formatNumber(pVal)}</td>
                    <td>${formatNumber(cVal)}</td>
                    <td style="${diffColor}">${diffStr}</td>
                    <td>${targetStr}</td>
                    <td>${compareTarget}</td>
                </tr>`;
            };

            const headerHTML = `<tr>
                <th>Chỉ số</th>
                <th>Ca làm việc</th>
                <th>${prevWeek || 'Tuần trước'}</th>
                <th>${week}</th>
                <th>So sánh</th>
                <th>Target</th>
                <th>So sánh với target</th>
            </tr>`;

            // Sort
            document.getElementById('ops-compare-sort-head').innerHTML = headerHTML;
            document.getElementById('ops-compare-sort-body').innerHTML = metrics.map(m => renderRow(m, 'sort')).join('');
            
            // InOut
            document.getElementById('ops-compare-inout-head').innerHTML = headerHTML;
            document.getElementById('ops-compare-inout-body').innerHTML = metrics.map(m => renderRow(m, 'inout')).join('');

            generateTargetAnalysis(currData, prevData, targetFixed);
        }

        function generateTargetAnalysis(currData, prevData, targetFixed) {
            let analysis = '';
            
            // Analyze SORT
            const sortKpi = currData.sort?.kpi || 0;
            const sortCost = currData.sort?.cost || 0;
            const sortXh = currData.sort?.xh || 0;
            
            let sortAnalysis = ``;
            if (sortKpi > 120) {
                sortAnalysis += `<span style="color:var(--success); font-weight:bold;">Đạt Max KPI (<span style="text-decoration: underline; text-decoration-style: double; text-decoration-color: var(--success);">120%</span>).</span> `;
            } else if (sortKpi >= 100) {
                sortAnalysis += `<span style="color:var(--success); font-weight:bold;">Đạt KPI (${sortKpi}%).</span> `;
            } else if (sortKpi >= 80) {
                sortAnalysis += `<span style="color:var(--warning); font-weight:bold;">Đạt KPI mức khá (${sortKpi}%).</span> `;
            } else if (sortKpi >= 50) {
                sortAnalysis += `<span style="color:var(--danger); font-weight:bold;">Chưa đạt KPI (${sortKpi}%).</span> `;
            } else if (sortKpi > 0) {
                sortAnalysis += `<span style="color:var(--danger); font-weight:bold;">Chưa đạt KPI (Tối thiểu 50%).</span> `;
            }

            if (sortCost > targetFixed.cost) {
                sortAnalysis += `Tuy nhiên, chi phí/đơn đang <span style="color:var(--danger)">vượt Target (${sortCost} > ${targetFixed.cost})</span>, cần kiểm soát lại giờ công. `;
            } else if (sortCost > 0) {
                sortAnalysis += `Chi phí/đơn <span style="color:var(--success)">được kiểm soát tốt (${sortCost} <= ${targetFixed.cost})</span>. `;
            }

            if (sortXh > targetFixed.xh) {
                sortAnalysis += `Tỉ lệ xuất hàng > 24h đang <span style="color:var(--danger)">cao hơn mức cho phép (${sortXh}% > ${targetFixed.xh}%)</span>, cần đẩy nhanh tiến độ xử lý hàng tồn. `;
            } else if (sortXh > 0) {
                sortAnalysis += `Tỉ lệ rớt hàng > 24h <span style="color:var(--success)">rất tốt (${sortXh}% <= ${targetFixed.xh}%)</span>. `;
            }
            
            analysis += `<p style="margin-bottom: 0.5rem;"><strong>👉 Phân tích SORT:</strong> ${sortAnalysis || 'Chưa có đủ dữ liệu để phân tích.'}</p>`;

            // Analyze INOUT
            const inoutKpi = currData.inout?.kpi || 0;
            const inoutCost = currData.inout?.cost || 0;
            const inoutXh = currData.inout?.xh || 0;

            let inoutAnalysis = ``;
            if (inoutKpi > 120) {
                inoutAnalysis += `<span style="color:var(--success); font-weight:bold;">Đạt Max KPI (<span style="text-decoration: underline; text-decoration-style: double; text-decoration-color: var(--success);">120%</span>).</span> `;
            } else if (inoutKpi >= 100) {
                inoutAnalysis += `<span style="color:var(--success); font-weight:bold;">Đạt KPI (${inoutKpi}%).</span> `;
            } else if (inoutKpi >= 80) {
                inoutAnalysis += `<span style="color:var(--warning); font-weight:bold;">Đạt KPI mức khá (${inoutKpi}%).</span> `;
            } else if (inoutKpi >= 50) {
                inoutAnalysis += `<span style="color:var(--danger); font-weight:bold;">Chưa đạt KPI (${inoutKpi}%).</span> `;
            } else if (inoutKpi > 0) {
                inoutAnalysis += `<span style="color:var(--danger); font-weight:bold;">Chưa đạt KPI (Tối thiểu 50%).</span> `;
            }

            if (inoutCost > targetFixed.cost) {
                inoutAnalysis += `Chi phí/đơn đang <span style="color:var(--danger)">vượt Target (${inoutCost} > ${targetFixed.cost})</span>. `;
            } else if (inoutCost > 0) {
                inoutAnalysis += `Chi phí/đơn <span style="color:var(--success)">được tối ưu tốt (${inoutCost} <= ${targetFixed.cost})</span>. `;
            }

            if (inoutXh > targetFixed.xh) {
                inoutAnalysis += `Tỉ lệ xuất hàng > 24h <span style="color:var(--danger)">bị vượt ngưỡng (${inoutXh}% > ${targetFixed.xh}%)</span>. `;
            } else if (inoutXh > 0) {
                inoutAnalysis += `Tỉ lệ rớt hàng > 24h <span style="color:var(--success)">vẫn trong tầm kiểm soát (${inoutXh}% <= ${targetFixed.xh}%)</span>. `;
            }

            analysis += `<p><strong>👉 Phân tích INOUT:</strong> ${inoutAnalysis || 'Chưa có đủ dữ liệu để phân tích.'}</p>`;

            document.getElementById('ops-target-analysis-content').innerHTML = analysis;
        }

        function formatNumber(val) {
            if (val === null || val === undefined || val === '') return '';
            if (!isNaN(val)) {
                return Number(val) % 1 !== 0 
                    ? Number(val).toLocaleString('en-US', {maximumFractionDigits: 2})
                    : Number(val).toLocaleString('en-US');
            }
            return val;
        }

        // ==========================================
        // QUẢN LÝ LƯƠNG LOGIC
        // ==========================================

        window.parsedSalaryData = [];

        function updateEmpPin() {
            if (!db) return alert("Chưa kết nối Cloud Firebase!");
            const empId = document.getElementById('admin-pin-id').value.trim();
            const newPin = document.getElementById('admin-pin-new').value.trim();
            if (!empId || !newPin) return alert("Vui lòng nhập Mã NV và PIN mới!");
            
            if (!window.SALARY_DATA || !window.SALARY_DATA[empId]) {
                if(!confirm(`Mã NV ${empId} hiện tại không có trong bảng lương tháng này. Bạn có chắc chắn muốn ép tạo mới/đổi PIN trên Cloud không?`)) return;
            }

            db.ref('salaryData/' + empId).update({ pin: newPin }).then(() => {
                alert(`✅ Đã cập nhật thành công mã PIN mới (${newPin}) cho NV: ${empId}`);
                document.getElementById('admin-pin-id').value = '';
                document.getElementById('admin-pin-new').value = '';
                if (window.SALARY_DATA && window.SALARY_DATA[empId]) {
                    window.SALARY_DATA[empId].pin = newPin;
                }
            }).catch(e => {
                alert("Lỗi khi cập nhật PIN: " + e.message);
            });
        }

        function syncSalaryFromFirebase() {
            const btn = document.getElementById('btn-sync-salary');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...';
            btn.disabled = true;

            setTimeout(() => {
                try {
                    if (!window.SALARY_DATA) {
                        alert("Không tìm thấy dữ liệu nội bộ! Vui lòng chạy file CapNhatLuong.bat trước.");
                        return;
                    }

                    const emps = Object.values(window.SALARY_DATA);
                    
                    const groups = {
                        'sort3': emps.filter(e => e.dept.toLowerCase().includes('sort') && e.shift.toLowerCase().includes('ca 3')),
                        'inout3': emps.filter(e => (e.dept.toLowerCase().includes('in/ out') || e.dept.toLowerCase().includes('inout')) && e.shift.toLowerCase().includes('ca 3')),
                        'inout5': emps.filter(e => (e.dept.toLowerCase().includes('in/ out') || e.dept.toLowerCase().includes('inout')) && e.shift.toLowerCase().includes('ca 5'))
                    };

                    document.getElementById('salary-dashboard').style.display = 'grid';
                    document.getElementById('salary-count-sort3').innerText = groups['sort3'].length + ' nv';
                    document.getElementById('salary-count-inout3').innerText = groups['inout3'].length + ' nv';
                    document.getElementById('salary-count-inout5').innerText = groups['inout5'].length + ' nv';

                    let analysisHtml = '';
                    const labels = {'sort3': 'SORT CA 3', 'inout3': 'INOUT CA 3', 'inout5': 'INOUT CA 5'};

                    for (const key in labels) {
                        const label = labels[key];
                        // Sắp xếp giảm dần theo lương
                        const list = groups[key].sort((a,b) => b.salary - a.salary);
                        const n = list.length;
                        
                        if (n === 0) continue;

                        const count20 = Math.max(1, Math.floor(n * 0.2));
                        const top20 = list.slice(0, count20);
                        const bottom20 = list.slice(n - count20, n);
                        const mid60 = list.slice(count20, n - count20);

                        const avgTop = top20.reduce((sum, e) => sum + e.salary, 0) / (top20.length || 1);
                        const avgMid = mid60.reduce((sum, e) => sum + e.salary, 0) / (mid60.length || 1);
                        const avgBottom = bottom20.reduce((sum, e) => sum + e.salary, 0) / (bottom20.length || 1);

                        analysisHtml += `
                            <div style="margin-bottom: 2.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; background: var(--bg-card); box-shadow: var(--shadow-sm);">
                                <h3 style="font-size: 1.25rem; color: var(--primary); margin-bottom: 1.5rem; border-bottom: 2px solid rgba(79, 70, 229, 0.2); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-users"></i> PHÂN TÍCH NHÓM: ${label} (Tổng: ${n} NV)</h3>
                                
                                <!-- Tổng hợp 3 ý chính -->
                                <div class="three-col-grid">
                                    <div style="background: rgba(16, 185, 129, 0.05); padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--success);">
                                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase;">Lương NV Không Off + Tăng Ca</p>
                                        <p style="font-size: 0.75rem; color: var(--success); margin-bottom: 0.5rem;">(Trung bình của Top 20%)</p>
                                        <div style="font-size: 1.75rem; color: var(--success); font-weight: 800;">${formatNumber(Math.round(avgTop))} ₫</div>
                                    </div>
                                    <div style="background: rgba(59, 130, 246, 0.05); padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--info);">
                                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase;">Lương NV Đi Làm Đủ Công</p>
                                        <p style="font-size: 0.75rem; color: var(--info); margin-bottom: 0.5rem;">(Trung bình của 60% số còn lại)</p>
                                        <div style="font-size: 1.75rem; color: var(--info); font-weight: 800;">${formatNumber(Math.round(avgMid))} ₫</div>
                                    </div>
                                    <div style="background: rgba(239, 68, 68, 0.05); padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--danger);">
                                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase;">NV Mới / Nghỉ Việc / Thiếu Công</p>
                                        <p style="font-size: 0.75rem; color: var(--danger); margin-bottom: 0.5rem;">(Trung bình của Bottom 20%)</p>
                                        <div style="font-size: 1.75rem; color: var(--danger); font-weight: 800;">${formatNumber(Math.round(avgBottom))} ₫</div>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                                    <!-- Top 20% -->
                                    <div>
                                        <h4 style="color: var(--warning); margin-bottom: 0.75rem; font-size: 1.05rem;"><i class="fa-solid fa-trophy"></i> Bảng Thành Tích (Top ${count20} NV có lương cao nhất)</h4>
                                        <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                                            <table class="data-table" style="width: 100%; font-size: 0.85rem;">
                                                <thead style="position: sticky; top: 0; background: var(--bg-card); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                                    <tr><th>Mã NV</th><th>Tên NV</th><th style="text-align:right;">Chi Lương</th></tr>
                                                </thead>
                                                <tbody>
                                                    ${top20.map((e, idx) => `<tr><td style="color:var(--text-muted); width: 80px;">${e.id}</td><td style="font-weight: 500;">${idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':''} ${escapeHTML(e.name)}</td><td style="text-align:right; font-weight:bold; color:var(--warning);">${formatNumber(e.salary)} ₫</td></tr>`).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- Bottom 20% -->
                                    <div>
                                        <h4 style="color: var(--danger); margin-bottom: 0.75rem; font-size: 1.05rem;"><i class="fa-solid fa-triangle-exclamation"></i> Bảng Lưu Ý (Top ${count20} NV có lương thấp nhất)</h4>
                                        <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                                            <table class="data-table" style="width: 100%; font-size: 0.85rem;">
                                                <thead style="position: sticky; top: 0; background: var(--bg-card); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                                    <tr><th>Mã NV</th><th>Tên NV</th><th style="text-align:right;">Chi Lương</th></tr>
                                                </thead>
                                                <tbody>
                                                    ${bottom20.map(e => `<tr><td style="color:var(--text-muted); width: 80px;">${e.id}</td><td style="font-weight: 500;">${escapeHTML(e.name)}</td><td style="text-align:right; font-weight:bold; color:var(--danger);">${formatNumber(e.salary)} ₫</td></tr>`).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }

                    if (analysisHtml === '') {
                        analysisHtml = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Không có nhân sự nào thuộc các ca: Sort Ca 3, Inout Ca 3, Inout Ca 5.</div>';
                    }

                    document.getElementById('salary-analysis-content').innerHTML = analysisHtml;
                    alert("Đồng bộ thành công! Đã cập nhật xong các bảng phân tích từ file nội bộ.");
                } catch (error) {
                    console.error(error);
                    alert("Có lỗi xảy ra khi lấy dữ liệu: " + error.message);
                } finally {
                    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Đồng Bộ Dữ Liệu Lương Mới Nhất';
                    btn.disabled = false;
                }
            }, 500);
        }

        // ==========================================
        // HR DASHBOARD LOGIC
        // ==========================================
        let hrActiveData = [];
        let hrResignedData = [];
        let currentFilteredResigned = [];
        let hrResignChartInstance = null;
        let hrNewChartInstance = null;
        let hrOverviewChartInstance = null;

        function renderHRDashboard() {
            if (!window.HR_DATA) {
                console.warn("Chưa có dữ liệu window.HR_DATA");
                document.getElementById('hr-table-container').innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Chưa có dữ liệu nhân sự. Vui lòng chạy file CapNhatNhanSu.bat</div>';
                document.getElementById('hr-table-container').style.display = 'block';
                return;
            }

            hrActiveData = window.HR_DATA.active || [];
            const rawResigned = window.HR_DATA.resigned || [];
            
            // Chỉ lấy những người nghỉ việc trong NĂM NAY (tránh hiện người từ 2023, 2024, 2025)
            const currentYear = new Date().getFullYear();
            hrResignedData = rawResigned.filter(e => {
                if (!e.leaveDateStr) return false;
                const parts = e.leaveDateStr.split('/');
                if (parts.length === 3) {
                    return parseInt(parts[2]) === currentYear;
                }
                return false;
            });

            const deptSelect = document.getElementById('hr-filter-dept');
            const shiftSelect = document.getElementById('hr-filter-shift');
            
            if (deptSelect.options.length <= 1) {
                const depts = [...new Set([...hrActiveData, ...hrResignedData].map(e => e.dept))].filter(Boolean).sort();
                const shifts = [...new Set([...hrActiveData, ...hrResignedData].map(e => e.shift))].filter(Boolean).sort();
                depts.forEach(d => deptSelect.add(new Option(d, d)));
                shifts.forEach(s => shiftSelect.add(new Option(s, s)));

                const weekSelect = document.getElementById('hr-filter-week');
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const pastDays = (now - startOfYear) / 86400000;
                const currentW = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
                for (let i = 0; i < 15; i++) {
                    const w = currentW - i;
                    if (w > 0) {
                        weekSelect.add(new Option(i === 0 ? `Tuần ${w} (Hiện tại)` : `Tuần ${w}`, w));
                    }
                }
            }

            const selDept = deptSelect.value;
            const selShift = shiftSelect.value;
            const selCriteria = document.getElementById('hr-filter-criteria').value;
            const selWeek = document.getElementById('hr-filter-week').value;

            const parseDate = (dStr) => {
                if (!dStr) return 0;
                const parts = dStr.split('/');
                if(parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]).getTime();
                return 0;
            };

            const getWeekNumber = (timestamp) => {
                if (!timestamp) return 0;
                const d = new Date(timestamp);
                const start = new Date(d.getFullYear(), 0, 1);
                return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
            };
            
            const getYearWeek = (timestamp) => {
                if (!timestamp) return 0;
                const d = new Date(timestamp);
                const start = new Date(d.getFullYear(), 0, 1);
                const w = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
                return d.getFullYear() * 100 + w;
            };

            const allData = [...hrActiveData, ...hrResignedData].sort((a,b) => b.daysWorked - a.daysWorked);
            const filteredData = allData.filter(e => {
                const matchDept = selDept === 'all' || e.dept === selDept;
                const matchShift = selShift === 'all' || e.shift === selShift;
                
                let matchCriteria = true;
                if (selCriteria === 'new_this_week') {
                    const ts = parseDate(e.joinDateStr);
                    const w = getWeekNumber(ts);
                    const isCurrentYear = new Date(ts).getFullYear() === new Date().getFullYear();
                    matchCriteria = selWeek === 'all' ? true : (w === parseInt(selWeek) && isCurrentYear);
                } else if (selCriteria === 'resigned_this_week') {
                    const ts = parseDate(e.leaveDateStr);
                    const w = getWeekNumber(ts);
                    const isCurrentYear = new Date(ts).getFullYear() === new Date().getFullYear();
                    matchCriteria = e.status === 'Đã nghỉ việc' && (selWeek === 'all' ? true : (w === parseInt(selWeek) && isCurrentYear));
                } else if (selCriteria === 'under_60_days') {
                    matchCriteria = (e.daysWorked <= 60);
                }

                return matchDept && matchShift && matchCriteria;
            });

            const activeCount = filteredData.filter(e => e.status !== 'Đã nghỉ việc').length;
            const resignedCount = filteredData.filter(e => e.status === 'Đã nghỉ việc').length;
            
            // Lưu lại danh sách nghỉ việc đã lọc để hiện lên Modal khi bấm vào
            currentFilteredResigned = filteredData.filter(e => e.status === 'Đã nghỉ việc');

            // Update UI
            document.getElementById('hr-stats').style.display = 'grid';
            document.getElementById('hr-table-container').style.display = 'block';
            document.getElementById('btn-hr-export').style.display = 'inline-flex';

            document.getElementById('hr-total').innerText = filteredData.length;
            document.getElementById('hr-active').innerText = activeCount;
            document.getElementById('hr-resigned').innerText = resignedCount;

            // --- Xử lý 3 Biểu đồ ---
            document.getElementById('hr-overview-chart-container').style.display = 'block';
            document.getElementById('hr-new-chart-container').style.display = 'block';
            document.getElementById('hr-chart-container').style.display = 'block'; // resign chart

            const nowChart = new Date();
            const startOfYearChart = new Date(nowChart.getFullYear(), 0, 1);
            const pastDaysChart = (nowChart - startOfYearChart) / 86400000;
            const currentWChart = Math.ceil((pastDaysChart + startOfYearChart.getDay() + 1) / 7);
            
            const last4Weeks = [currentWChart-3, currentWChart-2, currentWChart-1, currentWChart].filter(w => w > 0);
            const weekLabels = last4Weeks.map(w => `Tuần ${w}`);
            
            // 1. Dữ liệu cho Biểu đồ Tổng Quan
            const getHrCat = (d) => {
                if(!d) return 'other';
                const l = d.toLowerCase();
                if(l.includes('cồng kềnh')) return 'gc';
                if(l.includes('in')) return 'ns_in';
                if(l.includes('sort')) return 'ns_sort';
                return 'other';
            };
            const isStaff = (d) => {
                if (!d) return false;
                const l = d.toLowerCase();
                return !l.includes('supervisor') && !l.includes('coordinator');
            };
            const formatDeptLabel = (dept, shift) => {
                if (!dept) return '';
                const d = dept.toLowerCase();
                const s = shift ? shift.toLowerCase().replace('ca', '').trim() : '';
                
                // Inout: in/ out, phân kiện, cồng kềnh
                if (d.includes('in/ out') || d.includes('phân kiện') || d.includes('cồng kềnh')) return `Inout ${s}`;
                
                // Sort: sort, phân hàng
                if (d.includes('sort') || d.includes('phân hàng')) return `Sort ${s}`;
                
                return `${dept} ${shift}`;
            };
            
            const deptShiftsOverview = new Set();
            const activeDataByDeptShift = {};
            const totalNewData = last4Weeks.map(()=>0);
            const totalResignData = last4Weeks.map(()=>0);
            
            const curYearChart = new Date().getFullYear();
            const last4WeeksYW = last4Weeks.map(w => curYearChart * 100 + w);
            
            filteredData.forEach(e => {
                if (!isStaff(e.dept)) return; // Bỏ qua Supervisor
                
                const joinW = getWeekNumber(parseDate(e.joinDateStr));
                const leaveW = e.leaveDateStr ? getWeekNumber(parseDate(e.leaveDateStr)) : 9999;
                
                const joinYW = getYearWeek(parseDate(e.joinDateStr));
                const leaveYW = e.leaveDateStr ? getYearWeek(parseDate(e.leaveDateStr)) : 999999;
                
                const label = formatDeptLabel(e.dept, e.shift);
                
                deptShiftsOverview.add(label);
                if (!activeDataByDeptShift[label]) {
                    activeDataByDeptShift[label] = { 'ns': [0,0,0,0], 'gc': [0,0,0,0], 'new': [0,0,0,0], 'resign': [0,0,0,0] };
                }
                
                const dLower = e.dept ? e.dept.toLowerCase() : '';
                const pLower = e.position ? e.position.toLowerCase() : '';
                const isGC = dLower.includes('ctv') || dLower.includes('cồng kềnh') || pLower.includes('ctv') || pLower.includes('cồng kềnh');
                
                last4Weeks.forEach((w, i) => {
                    const wYW = last4WeeksYW[i];
                    if (joinYW <= wYW && leaveYW > wYW) activeDataByDeptShift[label][isGC ? 'gc' : 'ns'][i]++;
                    if (joinYW === wYW) {
                        totalNewData[i]++;
                        activeDataByDeptShift[label]['new'][i]++;
                    }
                    if (leaveYW === wYW) {
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
                
                const joinYW = getYearWeek(parseDate(e.joinDateStr));
                const leaveYW = e.leaveDateStr ? getYearWeek(parseDate(e.leaveDateStr)) : 999999;
                const label = formatDeptLabel(e.dept, e.shift);
                
                last4Weeks.forEach((w, i) => {
                    const wYW = last4WeeksYW[i];
                    if (joinYW === wYW) deptsNew.add(label);
                    if (leaveYW === wYW) deptsResign.add(label);
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
                
                const joinYW = getYearWeek(parseDate(e.joinDateStr));
                const leaveYW = e.leaveDateStr ? getYearWeek(parseDate(e.leaveDateStr)) : 999999;
                const label = formatDeptLabel(e.dept, e.shift);
                
                const wIdxJoin = last4WeeksYW.indexOf(joinYW);
                if (wIdxJoin > -1) {
                    const dIdx = uniqueDeptsNew.indexOf(label);
                    if (dIdx > -1) datasetsNewGrp[dIdx].data[wIdxJoin]++;
                }
                const wIdxLeave = last4WeeksYW.indexOf(leaveYW);
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
                        { type: 'line', label: `Tuyển mới (${lbl})`, data: v.new, borderColor: '#06b6d4', backgroundColor: '#06b6d4', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 },
                        { type: 'line', label: `Nghỉ việc (${lbl})`, data: v.resign, borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 3, yAxisID: 'y1', pointRadius: 5 }
                    ];
                    if (v.ns.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: `${lbl} NS`, data: v.ns, backgroundColor: '#3b82f6', stack: lbl, yAxisID: 'y' });
                    if (v.gc.some(val => val > 0)) allDatasetsOverview.push({ type: 'bar', label: `${lbl} GC`, data: v.gc, backgroundColor: '#93c5fd', stack: lbl, yAxisID: 'y' });
                }
            }
            
            const activeDatasetsOverview = allDatasetsOverview;
            
            hrOverviewChartInstance = new Chart(ctxOverview, {
                type: 'bar',
                data: { labels: weekLabels, datasets: activeDatasetsOverview },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: { type: 'linear', position: 'left', title: { display: true, text: 'Tổng nhân sự', color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, stacked: true, ticks: { color: '#9ca3af' } },
                        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Tuyển mới / Nghỉ việc', color: '#9ca3af' }, grid: { drawOnChartArea: false }, stacked: false, ticks: { color: '#9ca3af', stepSize: 1 } },
                        x: { stacked: true, ticks: { color: '#9ca3af', font: {weight: 'bold'} }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: '#e5e7eb', usePointStyle: true, boxWidth: 10 } },
                        datalabels: {
                            color: '#ffffff', textStrokeColor: 'rgba(0,0,0,0.6)', textStrokeWidth: 3,
                            font: { weight: 'bold', size: 12 },
                            anchor: 'center', align: (ctx) => ctx.dataset.type === 'line' ? 'bottom' : 'center',
                            offset: (ctx) => ctx.dataset.type === 'line' ? 8 : 0,
                            formatter: (val) => val > 0 ? val : ''
                        }
                    }
                }
            });

            // --- Render Biểu đồ Tuyển Mới ---
            const ctxNew = document.getElementById('hrNewChart').getContext('2d');
            if (hrNewChartInstance) hrNewChartInstance.destroy();
            hrNewChartInstance = new Chart(ctxNew, {
                type: 'bar',
                data: { labels: weekLabels, datasets: datasetsNewGrp.length > 0 ? datasetsNewGrp : [{ label: 'Không có dữ liệu', data: [0,0,0,0], backgroundColor: '#333' }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { ticks: { color: '#9ca3af', font: {weight: 'bold'} }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { color: '#e5e7eb', usePointStyle: true, boxWidth: 10 } },
                        datalabels: {
                            color: '#ffffff', textStrokeColor: 'rgba(0,0,0,0.6)', textStrokeWidth: 3, font: { weight: 'bold', size: 14 },
                            anchor: 'end', align: 'bottom', formatter: (val) => val > 0 ? val : ''
                        }
                    }
                }
            });

            // --- Render Biểu đồ Nghỉ việc ---
            const ctxHr = document.getElementById('hrResignChart').getContext('2d');
            if (hrResignChartInstance) hrResignChartInstance.destroy();
            hrResignChartInstance = new Chart(ctxHr, {
                type: 'bar',
                data: { labels: weekLabels, datasets: datasetsResignGrp.length > 0 ? datasetsResignGrp : [{ label: 'Không có dữ liệu', data: [0,0,0,0], backgroundColor: '#333' }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { ticks: { color: '#9ca3af', font: {weight: 'bold'} }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { color: '#e5e7eb', usePointStyle: true, boxWidth: 10 } },
                        datalabels: {
                            color: '#ffffff', textStrokeColor: 'rgba(0,0,0,0.6)', textStrokeWidth: 3, font: { weight: 'bold', size: 14 },
                            anchor: 'end', align: 'bottom', formatter: (val) => val > 0 ? val : ''
                        }
                    }
                }
            });

            let html = '';
            filteredData.forEach(e => {
                const rowStyle = e.status === 'Đã nghỉ việc' ? 'opacity: 0.7; background: rgba(239, 68, 68, 0.05);' : '';
                const badge = e.status === 'Đã nghỉ việc' ? '<span class="badge badge-danger">Đã nghỉ</span>' : '<span class="badge badge-success">Đang làm</span>';
                html += `
                    <tr style="${rowStyle}">
                        <td style="font-weight:600;">${escapeHTML(e.id)}</td>
                        <td>${escapeHTML(e.name)}</td>
                        <td>${escapeHTML(e.dept)}</td>
                        <td>${escapeHTML(e.shift)}</td>
                        <td>${e.joinDateStr} ${e.status === 'Đã nghỉ việc' ? '<br><small style="color:var(--danger); font-weight:600;">Nghỉ: '+e.leaveDateStr+'</small>' : ''}</td>
                        <td>${badge}</td>
                        <td style="color: var(--primary); font-weight: 600;">${e.daysWorked} ngày <br><small style="color:var(--text-muted);">(${e.monthsWorked} tháng)</small></td>
                    </tr>
                `;
            });
            document.getElementById('hr-table-body').innerHTML = html;
        }

        function showResignedModal() {
            if (!currentFilteredResigned || currentFilteredResigned.length === 0) {
                alert("Hiện không có nhân sự nào đã nghỉ việc (theo bộ lọc hiện tại).");
                return;
            }
            
            let html = '';
            const sorted = [...currentFilteredResigned].sort((a,b) => b.daysWorked - a.daysWorked);
            
            sorted.forEach(e => {
                const color = e.daysWorked >= 60 ? 'var(--danger)' : 'var(--warning)';
                html += `
                    <tr>
                        <td style="font-weight:600;">${escapeHTML(e.id)}</td>
                        <td style="font-weight:600;">${escapeHTML(e.name)}</td>
                        <td>${escapeHTML(e.dept)} <br> <small style="color:var(--text-muted);">${escapeHTML(e.shift)}</small></td>
                        <td>${e.joinDateStr}</td>
                        <td style="color: var(--danger); font-weight:600;">${e.leaveDateStr}</td>
                        <td style="font-style: italic; color: var(--text-muted); max-width: 200px; word-wrap: break-word;">${escapeHTML(e.leaveReason) || 'Không có ghi chú'}</td>
                        <td style="color: ${color}; font-weight: 800; font-size: 1.1rem;">${e.daysWorked} ngày</td>
                    </tr>
                `;
            });
            
            document.getElementById('hr-resigned-modal-body').innerHTML = html;
            document.getElementById('hr-resigned-modal').classList.add('active');
        }

        function closeResignedModal() {
            document.getElementById('hr-resigned-modal').classList.remove('active');
        }

        // Tự động render khi tải trang
        setTimeout(() => {
            renderHRDashboard();
        }, 500);

        function exportHRData() {
            if (hrActiveData.length === 0 && hrResignedData.length === 0) {
                alert("Không có dữ liệu để xuất!");
                return;
            }

            const formatForExcel = (arr) => arr.map(e => ({
                "Mã NV": e.id,
                "Họ Tên": e.name,
                "Phòng Ban": e.dept,
                "Ca Làm Việc": e.shift,
                "Ngày Vào Làm": e.joinDateStr,
                "Ngày Nghỉ Việc": e.leaveDateStr,
                "Trạng Thái": e.status,
                "Số Ngày Làm Việc": e.daysWorked,
                "Số Tháng Làm Việc": e.monthsWorked
            }));

            const wb = XLSX.utils.book_new();
            
            if (hrActiveData.length > 0) {
                const wsActive = XLSX.utils.json_to_sheet(formatForExcel(hrActiveData));
                XLSX.utils.book_append_sheet(wb, wsActive, "DS_Đang_Làm_Việc");
            }
            if (hrResignedData.length > 0) {
                const wsResigned = XLSX.utils.json_to_sheet(formatForExcel(hrResignedData));
                XLSX.utils.book_append_sheet(wb, wsResigned, "DS_Đã_Nghỉ_Việc");
            }

            XLSX.writeFile(wb, "Bao_Cao_Nhan_Su_Kho.xlsx");
        }

    