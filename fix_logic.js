const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /const selCriteria = document\.getElementById\('hr-filter-criteria'\)\?\.value \|\| 'all';\s+let combined = \[\];\s+if \(selCriteria === 'resigned_this_week'\) \{[\s\S]*?combined = \[\.\.\.activeList, \.\.\.resignedList\];\s+\}/;

const replacement = `const selCriteria = document.getElementById('hr-filter-criteria')?.value || 'all';
            const selWeek = document.getElementById('hr-filter-week')?.value || 'all';
            let combined = [];

            if (selCriteria === 'resigned_this_week') {
                combined = resignedList;
                if (selWeek !== 'all') {
                    const w = parseInt(selWeek);
                    combined = combined.filter(e => e.leaveDateStr && getWeekOfMonthFromStr(e.leaveDateStr) === w);
                }
            } else if (selCriteria === 'new_this_week') {
                combined = activeList;
                if (selWeek !== 'all') {
                    const w = parseInt(selWeek);
                    combined = combined.filter(e => e.joinDateStr && getWeekOfMonthFromStr(e.joinDateStr) === w);
                }
            } else if (selCriteria === 'under_60_days') {
                combined = [...activeList, ...resignedList].filter(e => (e.daysWorked || 0) <= 60);
            } else {
                combined = [...activeList, ...resignedList];
            }`;

if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Update successful');
} else {
    console.log('Regex did not match!');
}
