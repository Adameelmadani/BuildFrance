/* BUILD FRANCE - configuration (variables d'environnement / fichier .env) */
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

// Charge .env s'il existe (les variables déjà définies, ex. par systemd, restent prioritaires)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const env = process.env;
const int = (v, def) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def);
const bool = (v, def) => (v == null || v === '' ? def : /^(1|true|yes|on)$/i.test(String(v)));
if (!env.TZ) process.env.TZ = 'Europe/Paris';

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  host: env.HOST || '127.0.0.1',
  port: int(env.PORT, 3100),
  trustProxy: int(env.TRUST_PROXY, 1),
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  smtp: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 465),
    secure: bool(env.SMTP_SECURE, true),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  mailTo: env.MAIL_TO || 'buildfrance.sas@gmail.com',
  mailFrom: env.MAIL_FROM || env.SMTP_USER || 'buildfrance.sas@gmail.com',
};
