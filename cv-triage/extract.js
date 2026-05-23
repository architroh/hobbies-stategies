'use strict';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text.trim();
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractText(mimeType, buffer) {
  if (mimeType === 'application/pdf') {
    return extractPdf(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractDocx(buffer);
  }

  return null;
}

module.exports = { extractText };
