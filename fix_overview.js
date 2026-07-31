const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /}\r?\n\s+periodEl\.innerHTML = periodHtml;\r?\n\s+}/;
const replacement = `}
                periodEl.innerHTML = periodHtml;

                // Auto-select
                if (timeframe === 'week') {
                    const nowWeek = getWeekInfo(new Date());
                    if ([...periodEl.options].some(o => o.value === nowWeek.sundayStr)) {
                        periodEl.value = nowWeek.sundayStr;
                    }
                } else if (timeframe === 'month') {
                    const now = new Date();
                    const nowKey = \`\${now.getFullYear()}-\${String(now.getMonth()+1).padStart(2,'0')}\`;
                    if ([...periodEl.options].some(o => o.value === nowKey)) {
                        periodEl.value = nowKey;
                    }
                } else {
                    const nowStr = new Date().toISOString().split('T')[0];
                    if ([...periodEl.options].some(o => o.value === nowStr)) {
                        periodEl.value = nowStr;
                    }
                }
            }`;

if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Update successful');
} else {
    console.log('Regex failed');
}
