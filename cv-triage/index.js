'use strict';

require('dotenv').config();

const { authorize } = require('./auth');
const { processEmails } = require('./gmail');
const { classifyCV, VALID_CATEGORIES } = require('./classify');

function printSummary(tally) {
  const total = Object.values(tally).reduce((a, b) => a + b, 0);

  if (total === 0) {
    console.log('\nDone. No CVs were classified.');
    return;
  }

  const parts = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const shortName = cat.replace('CV/', '');
      return `${count} ${shortName}`;
    });

  console.log(`\nDone. ${total} CV${total === 1 ? '' : 's'} sorted: ${parts.join(', ')}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set. Add it to your .env file.');
    process.exit(1);
  }

  console.log('CV Triage — connecting to Gmail...');

  let auth;
  try {
    auth = await authorize();
  } catch (err) {
    console.error(`Auth error: ${err.message}`);
    process.exit(1);
  }

  console.log('Authenticated.\n');

  const tally = await processEmails(auth, classifyCV);
  printSummary(tally);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
