const fs = require('fs');
const logFile = 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/53758bf4-3aac-4f6a-af5e-6c15b0d4e1da/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logFile, 'utf8').split('\n');
console.log('Total lines in transcript_full.jsonl:', lines.length);
for (let i = lines.length - 1; i >= Math.max(0, lines.length - 30); i--) {
  if (lines[i].includes('Date,Receipt number')) {
    console.log(`Line ${i} has Date,Receipt number! Len: ${lines[i].length}`);
    const obj = JSON.parse(lines[i]);
    const text = obj.content || '';
    const p1 = text.indexOf('Date,Receipt number,Receipt type,Gross sales');
    const p2 = text.indexOf('Date,Receipt number,Receipt type,Category');
    if (p1 !== -1 && p2 !== -1) {
      const rCsv = text.substring(p1, p2).trim();
      const iCsv = text.substring(p2).trim();
      fs.writeFileSync('scripts/temp_receipts/receipts.csv', rCsv, 'utf8');
      fs.writeFileSync('scripts/temp_receipts/receipts_by_item.csv', iCsv, 'utf8');
      console.log(`Extracted: receipts.csv (${rCsv.length} bytes), receipts_by_item.csv (${iCsv.length} bytes)`);
      break;
    }
  }
}
