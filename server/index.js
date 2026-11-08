/* BUILD FRANCE - serveur du site vitrine : pages statiques + API du formulaire de contact */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const config = require('./config');
const mailer = require('./mailer');

fs.mkdirSync(config.dataDir, { recursive: true });
const MESSAGES = path.join(config.dataDir, 'messages.jsonl');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

/* ---------- en-têtes de sécurité ---------- */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "frame-src https://www.google.com https://maps.google.com",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

/* ---------- API ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true, smtp: mailer.configured }));

// Limite : 5 demandes par adresse IP et par quart d'heure
const hits = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 5;
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  h.push(now);
  hits.set(ip, h);
  return h.length > MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (!h.some((t) => now - t < WINDOW)) hits.delete(ip);
}, WINDOW).unref();

const PROJETS = ['Construction de maison', 'Maçonnerie', 'Rénovation / extension', 'Agencement intérieur',
  'Aménagement extérieur', 'Professionnel / sous-traitance'];
const DELAIS = ['Dès que possible', 'Dans les 3 mois', 'Dans 3 à 6 mois', "Plus tard / projet à l'étude"];
const clean = (v, max) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
// Champs d'une seule ligne : retours à la ligne et caractères de contrôle remplacés par des espaces
const line = (v, max) => clean(String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' '), max);

/** Valide la demande ; renvoie { data } ou { errors: { champ: message } } */
function validate(b) {
  const d = {
    projet: line(b.projet, 60),
    nom: line(b.nom, 120),
    telephone: line(b.telephone, 30),
    email: line(b.email, 200),
    commune: line(b.commune, 120),
    delai: line(b.delai, 60),
    message: clean(b.message, 5000),
  };
  const errors = {};
  if (d.nom.length < 2) errors.nom = 'Indiquez votre nom.';
  if (!/^[+\d][\d\s.()-]{8,}$/.test(d.telephone)) errors.telephone = 'Indiquez un numéro de téléphone valide.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) errors.email = 'Cette adresse e-mail ne semble pas valide.';
  if (d.message.length < 10) errors.message = 'Décrivez votre projet en quelques mots.';
  if (b.consent !== true) errors.consent = 'Merci de cocher la case d\'accord.';
  if (d.projet && !PROJETS.includes(d.projet)) d.projet = '';
  if (d.delai && !DELAIS.includes(d.delai)) d.delai = '';
  return Object.keys(errors).length ? { errors } : { data: d };
}

app.post('/api/contact', express.json({ limit: '20kb' }), async (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Requête invalide.' });
  const b = req.body || {};

  // Anti-robots : champ piège rempli, ou formulaire envoyé en moins de 3 secondes.
  // On répond « OK » sans rien faire, pour ne pas renseigner le robot.
  if (b.website || Number(b.elapsed) < 3000) return res.json({ ok: true });

  if (limited(req.ip)) {
    return res.status(429).json({ error: 'Trop de demandes envoyées. Réessayez dans quelques minutes ou appelez-nous au 06 52 47 30 05.' });
  }

  const { data, errors } = validate(b);
  if (errors) return res.status(400).json({ error: 'Certains champs sont à corriger.', fields: errors });

  data.id = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  data.receivedAt = new Date().toISOString();

  // 1. On enregistre toujours la demande : rien n'est perdu même si l'e-mail échoue
  try {
    fs.appendFileSync(MESSAGES, JSON.stringify(data) + '\n', { mode: 0o600 });
  } catch (e) {
    console.error('Impossible d\'enregistrer la demande', e);
  }

  // 2. Puis on l'envoie par e-mail
  try {
    await mailer.sendContact(data);
    console.log(`Demande ${data.id} reçue et envoyée par e-mail.`);
  } catch (e) {
    console.error(`ERREUR D'ENVOI DE L'E-MAIL pour la demande ${data.id} (conservée dans ${MESSAGES}) :`, e.message);
  }
  res.json({ ok: true, id: data.id });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));

/* ---------- pages et fichiers ---------- */
app.use(express.static(config.PUBLIC_DIR, {
  extensions: ['html'], // /contact affiche contact.html
  setHeaders(res, file) {
    if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
    else if (/\.(css|js)$/.test(file)) res.set('Cache-Control', 'public, max-age=86400');
    else res.set('Cache-Control', 'public, max-age=2592000'); // images, logos : 30 jours
  },
}));

app.use((req, res) => res.status(404).sendFile(path.join(config.PUBLIC_DIR, '404.html')));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const message = err.type === 'entity.too.large' ? 'Message trop long.'
    : err.type === 'entity.parse.failed' ? 'Requête invalide.'
    : status >= 500 ? 'Erreur interne du serveur.' : err.message;
  if (req.path.startsWith('/api')) res.status(status).json({ error: message });
  else res.status(status).type('text').send(message);
});

/* ---------- démarrage ---------- */
const server = app.listen(config.port, config.host, () => {
  console.log(`Site BUILD FRANCE démarré sur http://${config.host}:${config.port}`);
  console.log(`Demandes enregistrées dans : ${MESSAGES}`);
  if (!mailer.configured) console.warn('SMTP non configuré : les demandes sont affichées ici au lieu d\'être envoyées (voir .env).');
});

const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
