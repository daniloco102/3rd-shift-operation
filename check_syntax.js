const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
let scriptContent = '';
if (match) {
    match.forEach(m => {
        scriptContent += m.replace(/<script\b[^>]*>/i, '').replace(/<\/script>/i, '') + '\n';
    });
}
try {
    new Function(scriptContent);
    console.log("Syntax check passed!");
} catch (e) {
    console.log("Syntax Error:", e);
}
