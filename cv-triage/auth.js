'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const open = require('open');
const readline = require('readline');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      'credentials.json not found. Download it from Google Cloud Console.\n' +
      'See README.md for setup instructions.'
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function createOAuth2Client(credentials) {
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\nOpening browser for Google OAuth consent...');
  console.log('If browser does not open, visit this URL manually:\n');
  console.log(authUrl + '\n');

  try {
    await open(authUrl);
  } catch {
    // browser open failed, user will use the URL printed above
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Enter the authorization code from the browser: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to token.json\n');
  return oAuth2Client;
}

async function authorize() {
  const credentials = loadCredentials();
  const oAuth2Client = createOAuth2Client(credentials);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);

    // Persist refreshed tokens automatically
    oAuth2Client.on('tokens', (newTokens) => {
      const updated = { ...token, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
    });

    return oAuth2Client;
  }

  return getNewToken(oAuth2Client);
}

module.exports = { authorize };
