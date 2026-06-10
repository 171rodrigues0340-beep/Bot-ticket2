const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ticket-db.json');

const DEFAULT_DB = {
  panel: {
    title: '🎫 Atendimento',
    description: 'Clique no botão abaixo para abrir um ticket com a nossa equipe.',
    color: '#5865F2',
    buttonLabel: 'Abrir ticket',
    buttonEmoji: '🎫',
    buttonStyle: 'Primary',
bannerUrl: null
  },
  ids: {
    supportRoleId: null,
    ownerRoleId: null,
    logChannelId: null,
    categoryId: null
  },
  panelMessage: {
    channelId: null,
    messageId: null
  },
  tickets: {}
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return { ...DEFAULT_DB, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Erro lendo banco JSON:', error);
    return structuredClone(DEFAULT_DB);
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { readDb, writeDb, DEFAULT_DB };
