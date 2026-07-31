const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetHTML = '<option value="all">Mọi thời điểm</option>';
const replacementHTML = `<option value="all">Mọi thời điểm</option>
                                    <option value="1">Tuần 1</option>
                                    <option value="2">Tuần 2</option>
                                    <option value="3">Tuần 3</option>
                                    <option value="4">Tuần 4</option>
                                    <option value="5">Tuần 5</option>`;

html = html.replace(targetHTML, replacementHTML);

const targetJS = `            if (selCriteria === 'resigned_this_week') {
                combined = resignedList;
            } else if (selCriteria === 'new_this_week') {
                combined = activeList;
            } else {
                combined = [...activeList, ...resignedList];
            }`;

const replacementJS = `            const selWeek = document.getElementById('hr-filter-week')?.value || 'all';

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
            } else {
                combined = [...activeList, ...resignedList];
            }`;

html = html.replace(targetJS, replacementJS);
fs.writeFileSync('index.html', html);
console.log('Update successful');
