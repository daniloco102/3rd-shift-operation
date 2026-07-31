const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /function renderHRDetailTable\(activeList, resignedList\) \{\s+const tbody/;
const replacement = `function renderHRDetailTable(activeList, resignedList) {
            const getWeekOfMonthFromStr = (dStr) => {
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
            const tbody`;

if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Update successful');
} else {
    console.log('Regex did not match!');
}
