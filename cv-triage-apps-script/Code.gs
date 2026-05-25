// ── CV Auto-Triage — Google Apps Script ────────────────────────────────────
// Paste this entire file into script.google.com and click Run → triageCVs
// No API keys, no setup beyond pasting. Gmail access is built in.
// ────────────────────────────────────────────────────────────────────────────

var LABEL_PREFIX = 'CV/';
var MAX_EMAILS   = 50;

var CATEGORIES = {
  'CV/Project Manager - Civil':       civilKeywords(),
  'CV/Project Manager - Mechanical':  mechanicalKeywords(),
  'CV/Project Manager - Electrical':  electricalKeywords(),
  'CV/Planning Lead':                 planningKeywords(),
  'CV/Site Engineer':                 siteEngineerKeywords(),
  'CV/Project Manager - General':     generalPMKeywords(),
};

// ── Entry point ──────────────────────────────────────────────────────────────

function triageCVs() {
  Logger.log('CV Triage starting...');

  var threads = GmailApp.search(
    'in:inbox (filename:pdf OR filename:doc OR filename:docx) -label:CV',
    0,
    MAX_EMAILS
  );

  if (threads.length === 0) {
    Logger.log('No unread emails with attachments found.');
    return;
  }

  Logger.log('Found ' + threads.length + ' thread(s) to process.');

  var tally = {};

  threads.forEach(function(thread) {
    var message  = thread.getMessages()[0];
    var subject  = message.getSubject();
    var text     = extractText(message);

    if (!text || text.trim().length < 50) {
      Logger.log('SKIP (no text): ' + subject);
      return;
    }

    var result   = classify(text);
    var category = result.category;
    var conf     = result.confidence;


    var note = (category === 'CV/Needs Review' && !result.cvSignal)
      ? ' [no CV keywords detected — manual check advised]'
      : '';
    Logger.log('Processing "' + subject + '" → ' + category + ' (' + conf + ')' + note);

    applyLabelAndArchive(thread, category);

    tally[category] = (tally[category] || 0) + 1;
  });

  printSummary(tally);
}

// ── Text extraction ──────────────────────────────────────────────────────────

function extractText(message) {
  var parts = [message.getPlainBody()];

  var attachments = message.getAttachments();
  attachments.forEach(function(att) {
    var mime = att.getContentType();

    if (mime === 'application/pdf') {
      parts.push(extractFromPdf(att));
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      parts.push(extractFromDoc(att));
    }
  });

  return parts.filter(Boolean).join('\n\n');
}

function extractFromPdf(attachment) {
  try {
    // Upload to Drive as a temp file, convert to Google Doc, read text, delete
    var blob    = attachment.copyBlob();
    var file    = DriveApp.createFile(blob);
    var docFile = Drive.Files.copy(
      { title: 'cv_temp', mimeType: 'application/vnd.google-apps.document' },
      file.getId(),
      { convert: true }
    );
    var text = DocumentApp.openById(docFile.id).getBody().getText();
    DriveApp.getFileById(docFile.id).setTrashed(true);
    file.setTrashed(true);
    return text;
  } catch (e) {
    Logger.log('  PDF extraction failed: ' + e.message);
    return '';
  }
}

function extractFromDoc(attachment) {
  try {
    var blob    = attachment.copyBlob().setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var file    = DriveApp.createFile(blob);
    var docFile = Drive.Files.copy(
      { title: 'cv_temp', mimeType: 'application/vnd.google-apps.document' },
      file.getId(),
      { convert: true }
    );
    var text = DocumentApp.openById(docFile.id).getBody().getText();
    DriveApp.getFileById(docFile.id).setTrashed(true);
    file.setTrashed(true);
    return text;
  } catch (e) {
    Logger.log('  DOCX extraction failed: ' + e.message);
    return '';
  }
}

// ── Keyword classifier ────────────────────────────────────────────────────────

function classify(text) {
  var lower  = text.toLowerCase();
  var scores = {};

  Object.keys(CATEGORIES).forEach(function(category) {
    var keywords = CATEGORIES[category];
    var score    = 0;
    keywords.forEach(function(kw) {
      var pattern = new RegExp('\\b' + escapeRegex(kw) + '\\b', 'gi');
      var matches = lower.match(pattern);
      if (matches) score += matches.length;
    });
    scores[category] = score;
  });

  // Pick highest scoring category
  var best      = null;
  var bestScore = 0;

  Object.keys(scores).forEach(function(cat) {
    if (scores[cat] > bestScore) {
      bestScore = scores[cat];
      best      = cat;
    }
  });

  var confidence = bestScore >= 6 ? 'high' : bestScore >= 3 ? 'medium' : 'low';

  // If score is too low to confidently bucket, check whether the content
  // looks like a CV at all (resume/cv keywords). If yes → Needs Review.
  // If no CV signal whatsoever → still Needs Review so nothing is silently dropped.
  if (bestScore < 2) {
    var cvSignal = cvDetectionKeywords().some(function(kw) {
      return lower.indexOf(kw) !== -1;
    });
    return {
      category:   'CV/Needs Review',
      confidence: 'low',
      score:      bestScore,
      cvSignal:   cvSignal,
    };
  }

  return { category: best, confidence: confidence, score: bestScore };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function getOrCreateLabel(name) {
  var existing = GmailApp.getUserLabelByName(name);
  if (existing) return existing;
  return GmailApp.createLabel(name);
}

function applyLabelAndArchive(thread, categoryName) {
  var label = getOrCreateLabel(categoryName);
  thread.addLabel(label);
  thread.moveToArchive();
  thread.markRead();
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(tally) {
  var keys  = Object.keys(tally);
  var total = keys.reduce(function(sum, k) { return sum + tally[k]; }, 0);

  if (total === 0) {
    Logger.log('\nDone. No CVs classified.');
    return;
  }

  var parts = keys
    .sort(function(a, b) { return tally[b] - tally[a]; })
    .map(function(k) { return tally[k] + ' × ' + k.replace('CV/', ''); });

  Logger.log('\nDone. ' + total + ' CV(s) sorted:');
  parts.forEach(function(p) { Logger.log('  ' + p); });
}

// ── Keyword lists ─────────────────────────────────────────────────────────────

function civilKeywords() {
  return [
    'civil engineering', 'civil engineer', 'civil pm', 'civil project manager',
    'infrastructure', 'highways', 'roads', 'drainage', 'earthworks', 'grading',
    'geotechnical', 'structures', 'bridges', 'tunnels', 'utilities',
    'water treatment', 'sewage', 'reinforced concrete', 'piling', 'groundworks',
    'site clearance', 'cut and fill', 'retaining wall', 'cabling civil'
  ];
}

function mechanicalKeywords() {
  return [
    'mechanical engineering', 'mechanical engineer', 'mechanical pm',
    'mechanical project manager', 'hvac', 'plumbing', 'pipework', 'piping',
    'plant engineering', 'rotating equipment', 'pumps', 'compressors',
    'heat exchanger', 'pressure vessels', 'mechanical installation',
    'ventilation', 'ductwork', 'chiller', 'boiler', 'steam', 'process piping',
    'oil and gas mechanical', 'mechanical commissioning', 'mep mechanical'
  ];
}

function electricalKeywords() {
  return [
    'electrical engineering', 'electrical engineer', 'electrical pm',
    'electrical project manager', 'high voltage', 'low voltage', 'hv', 'lv',
    'mv', 'medium voltage', 'switchgear', 'transformers', 'power distribution',
    'cabling', 'cable management', 'electrical installation', 'earthing',
    'protection relay', 'substation', 'plc', 'scada', 'instrumentation',
    'control systems', 'electrical commissioning', 'mep electrical',
    'building management system', 'bms', 'ups', 'generator'
  ];
}

function planningKeywords() {
  return [
    'planning lead', 'planning manager', 'programme manager', 'programme lead',
    'project planner', 'planning engineer', 'scheduler', 'scheduling',
    'primavera', 'p6', 'ms project', 'programme development', 'programme control',
    'baseline programme', 'delay analysis', 'earned value', 'evm',
    'critical path', 'lookahead', 'resource planning', 'schedule management',
    'programme reporting', 'gantt chart', 'float analysis', 'planning team'
  ];
}

function siteEngineerKeywords() {
  return [
    'site engineer', 'site engineering', 'resident engineer',
    'setting out', 'surveying', 'topographic survey', 'total station',
    'gps survey', 'levelling', 'as-built', 'quality engineer',
    'qc engineer', 'rfi', 'method statement', 'inspection test plan',
    'itp', 'daily diary', 'site supervision', 'works engineer',
    'civil site', 'site technical', 'construction engineer'
  ];
}

function generalPMKeywords() {
  return [
    'project manager', 'project management', 'programme management',
    'pmp', 'prince2', 'agile pm', 'delivery manager', 'project director',
    'project lead', 'project coordinator', 'stakeholder management',
    'risk management', 'change management', 'contract management',
    'nec', 'fidic', 'jct', 'cost control', 'budget management',
    'project controls', 'project reporting', 'project governance'
  ];
}

// Used to detect "this is a CV" even when we can't bucket the discipline.
// Emails matching these but scoring too low on role keywords → CV/Needs Review.
function cvDetectionKeywords() {
  return [
    'curriculum vitae', 'résumé', 'resume', ' cv ', '\ncv\n', 'my cv',
    'please find my', 'please find attached my', 'attached my cv',
    'attached my resume', 'i am applying', 'i wish to apply',
    'application for', 'applying for the position', 'applying for the role',
    'cover letter', 'personal statement', 'years of experience',
    'work experience', 'employment history', 'professional summary',
    'career objective', 'career summary', 'key skills', 'core competencies',
    'references available', 'references on request', 'date of birth',
    'nationality', 'linkedin.com/in/', 'looking for a new opportunity',
    'open to opportunities', 'seeking a position', 'job application'
  ];
}
