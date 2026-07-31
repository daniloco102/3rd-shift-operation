const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// I will use regex to find getWeekOfMonthFromStr
const regex = /const getWeekOfMonthFromStr = \(dStr\) => \{[\s\S]*?return 0;\s*\};\r?\n/;

const newHelper = `const getWeekOfMonthFromStr = (dStr) => {
                if (!dStr) return 0;
                const parts = dStr.split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    if (day <= 7) return 1;
                    if (day <= 14) return 2;
                    if (day <= 21) return 3;
                    if (day <= 28) return 4;
                    return 5;
                }
                return 0;
            };

            const getISOWeek = (day, mStr, yStr) => {
                const d = new Date(Date.UTC(parseInt(yStr), parseInt(mStr)-1, day));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
                return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
            };
            const genLabels = (mKey) => {
                if (!mKey) return ['Tuần 1','Tuần 2','Tuần 3','Tuần 4','Tuần 5'];
                const m = mKey.split('/')[0];
                const y = mKey.split('/')[1];
                let res = [];
                [4, 11, 18, 25, 29].forEach(d => {
                    let w = 'Tuần ' + getISOWeek(d, m, y);
                    if (res.includes(w)) w += ' (b)';
                    res.push(w);
                });
                return res;
            };
            const labelsPrev = genLabels(prevMonthKey);
            const labelsCurr = genLabels(selMonth);

            const weekDropdown = document.getElementById('hr-filter-week');
            if (weekDropdown) {
                const selW = weekDropdown.value;
                weekDropdown.innerHTML = '<option value="all">Mọi thời điểm</option>';
                labelsCurr.forEach((lbl, idx) => {
                    weekDropdown.innerHTML += \`<option value="\${idx+1}">\${lbl}</option>\`;
                });
                if ([...weekDropdown.options].some(o => o.value === selW)) {
                    weekDropdown.value = selW;
                } else {
                    weekDropdown.value = 'all';
                }
            }
`;

if (regex.test(html)) {
    html = html.replace(regex, newHelper);
    fs.writeFileSync('index.html', html);
    console.log('Update successful');
} else {
    console.log('Regex did not match!');
}
