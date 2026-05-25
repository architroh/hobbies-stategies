'use strict';

const { google } = require('googleapis');
const { extractText } = require('./extract');

const CV_LABEL_PREFIX = 'CV/';
const MAX_EMAILS = 50;
const RATE_LIMIT_DELAY = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGmailClient(auth) {
  return google.gmail({ version: 'v1', auth });
}

// ── Label management ────────────────────────────────────────────────────────

async function listAllLabels(gmail) {
  const res = await gmail.users.labels.list({ userId: 'me' });
  return res.data.labels || [];
}

async function ensureLabel(gmail, labelName, labelCache) {
  if (labelCache[labelName]) return labelCache[labelName];

  const all = await listAllLabels(gmail);
  const existing = all.find((l) => l.name === labelName);
  if (existing) {
    labelCache[labelName] = existing.id;
    return existing.id;
  }

  // Create the label
  const res = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  console.log(`  Created label: ${labelName}`);
  labelCache[labelName] = res.data.id;
  return res.data.id;
}

// ── Fetch emails ─────────────────────────────────────────────────────────────

async function fetchUnreadCVCandidates(gmail) {
  // Unread, has attachment, not already labelled CV/*
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: MAX_EMAILS,
    q: 'is:unread has:attachment -label:CV',
  });

  return res.data.messages || [];
}

async function getMessageDetail(gmail, messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return res.data;
}

// ── Extract content from a message ───────────────────────────────────────────

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function getBodyText(payload) {
  const lines = [];

  function walk(part) {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      lines.push(decodeBase64(part.body.data).toString('utf8'));
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return lines.join('\n').trim();
}

async function downloadAttachment(gmail, messageId, attachmentId) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  return decodeBase64(res.data.data);
}

async function extractEmailContent(gmail, message) {
  const bodyText = getBodyText(message.payload);
  const attachmentTexts = [];

  const collectParts = [];
  function walk(part) {
    if (!part) return;
    if (part.filename && part.body) {
      collectParts.push(part);
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(message.payload);

  for (const part of collectParts) {
    const attachmentId = part.body.attachmentId;
    if (!attachmentId) continue;

    try {
      const buffer = await downloadAttachment(gmail, message.id, attachmentId);
      const text = await extractText(part.mimeType, buffer);
      if (text) attachmentTexts.push(text);
    } catch (err) {
      console.warn(`  Warning: could not extract attachment "${part.filename}": ${err.message}`);
    }
  }

  return [bodyText, ...attachmentTexts].filter(Boolean).join('\n\n');
}

// ── Label + archive ───────────────────────────────────────────────────────────

async function applyLabelAndArchive(gmail, messageId, labelId) {
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds: ['INBOX', 'UNREAD'],
    },
  });
}

function getSubject(message) {
  const headers = message.payload.headers || [];
  const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject');
  return subjectHeader ? subjectHeader.value : '(no subject)';
}

function hasExistingCVLabel(message) {
  const labels = message.labelIds || [];
  // Gmail API returns label IDs, not names, so we rely on the search query
  // filtering, but double-check via label names from a cache if needed.
  // The search query `is:unread has:attachment -label:CV` already excludes them.
  return false;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function processEmails(auth, classifyFn) {
  const gmail = getGmailClient(auth);
  const labelCache = {};

  const messages = await fetchUnreadCVCandidates(gmail);

  if (messages.length === 0) {
    console.log('No unread emails with attachments found.');
    return {};
  }

  console.log(`Found ${messages.length} candidate email(s) to process.\n`);

  const tally = {};

  for (const { id } of messages) {
    await sleep(RATE_LIMIT_DELAY);

    let message;
    try {
      message = await getMessageDetail(gmail, id);
    } catch (err) {
      console.error(`  Error fetching message ${id}: ${err.message}`);
      continue;
    }

    const subject = getSubject(message);
    process.stdout.write(`Processing "${subject}"... `);

    let content;
    try {
      content = await extractEmailContent(gmail, message);
    } catch (err) {
      console.warn(`\n  Warning: extraction failed — ${err.message}`);
      content = '';
    }

    if (!content) {
      console.log('⚠ skipped (no extractable text)');
      continue;
    }

    const result = await classifyFn(content);

    if (!result) {
      console.log('⚠ skipped (classification error)');
      continue;
    }

    const { category, candidate_name, confidence, rationale } = result;
    console.log(`→ ${category} (${confidence} confidence)`);
    if (candidate_name) console.log(`  Candidate: ${candidate_name}`);

    try {
      const labelId = await ensureLabel(gmail, category, labelCache);
      await applyLabelAndArchive(gmail, id, labelId);
    } catch (err) {
      console.error(`  Error applying label: ${err.message}`);
      continue;
    }

    tally[category] = (tally[category] || 0) + 1;
  }

  return tally;
}

module.exports = { processEmails };
