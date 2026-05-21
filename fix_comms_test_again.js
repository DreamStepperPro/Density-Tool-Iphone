const fs = require('fs');

let content = fs.readFileSync('comms.test.js', 'utf8');

// Ensure limitToLast is in the mock
if (!content.includes('limitToLast: mock')) {
    content = content.replace("equalTo: mock(() => ({}))", "equalTo: mock(() => ({})),\n    limitToLast: mock(() => ({}))");
    fs.writeFileSync('comms.test.js', content, 'utf8');
}
