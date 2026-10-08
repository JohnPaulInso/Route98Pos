// ============================================================
// tests/run-all.js
// Master test runner for all live sync automated test suites
// ============================================================
const { runInventorySyncTest } = require('./inventory/test-live-inventory');
const { runReceiptsSyncTest } = require('./receipts/test-live-receipts');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

async function runAllSuites() {
  console.clear();
  console.log(`${COLORS.magenta}${COLORS.bold}============================================================${COLORS.reset}`);
  console.log(`${COLORS.magenta}${COLORS.bold}  ROUTE 98 POS - AUTOMATED REAL-TIME SYNC TEST RUNNER      ${COLORS.reset}`);
  console.log(`${COLORS.magenta}${COLORS.bold}============================================================${COLORS.reset}\n`);

  console.log(`${COLORS.cyan}Running Test Suite 1: Live Multi-Device Inventory Sync...${COLORS.reset}`);
  await runInventorySyncTest();

  console.log(`\n${COLORS.cyan}Running Test Suite 2: Live Multi-Device Receipts Sync...${COLORS.reset}`);
  await runReceiptsSyncTest();

  console.log(`\n${COLORS.green}${COLORS.bold}============================================================${COLORS.reset}`);
  console.log(`${COLORS.green}${COLORS.bold}  ALL AUTOMATED PLAYWRIGHT TEST SUITES COMPLETED!           ${COLORS.reset}`);
  console.log(`${COLORS.green}${COLORS.bold}============================================================${COLORS.reset}\n`);
}

if (require.main === module) {
  runAllSuites().catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runAllSuites };
