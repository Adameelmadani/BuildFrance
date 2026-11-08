/* BUILD FRANCE - envoi des demandes de devis par e-mail (SMTP) */
'use strict';
const nodemailer = require('nodemailer');
const config = require('./config');

const configured = !!(config.smtp.host && config.smtp.user && config.smtp.pass);

// Sans SMTP configuré (développement), les e-mails sont affichés dans la console au lieu d'être envoyés
const transport = configured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/** Construit et envoie l'e-mail d'une demande de devis */
async function sendContact(d) {
  const date = new Date(d.receivedAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  const rows = [
    ['Nom', d.nom],
    ['Téléphone', d.telephone],
    ['E-mail', d.email || '-'],
    ['Commune du chantier', d.commune || '-'],
    ['Type de projet', d.projet || 'Non précisé'],
    ['Délai souhaité', d.delai || '-'],
  ];
  const text = [
    `Nouvelle demande reçue depuis le site, le ${date}.`,
    '',
    ...rows.map(([k, v]) => `${k} : ${v}`),
    '',
    'Message :',
    d.message,
    '',
    `Référence : ${d.id}`,
  ].join('\n');
  const tel = d.telephone.replace(/[^\d+]/g, '');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#161616;max-width:640px">
    <div style="border-top:4px solid #f08a0a;padding:18px 0 6px"><b style="font-size:18px">Nouvelle demande de devis</b><br>
    <span style="color:#666">Reçue depuis le site le ${esc(date)}</span></div>
    <table style="border-collapse:collapse;width:100%;margin:12px 0">${rows.map(([k, v]) =>
      `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #ddd;color:#666;white-space:nowrap">${esc(k)}</td>
       <td style="padding:8px 0;border-bottom:1px solid #ddd;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>
    <p style="margin:18px 0 6px;color:#666">Message :</p>
    <div style="background:#f6f6f6;border-left:4px solid #f08a0a;padding:12px 16px;white-space:pre-wrap">${esc(d.message)}</div>
    <p style="margin:22px 0"><a href="tel:${esc(tel)}" style="background:#d25e00;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:bold">Appeler ${esc(d.telephone)}</a></p>
    <p style="color:#999;font-size:12px">Référence : ${esc(d.id)}${d.email ? ' · Répondez directement à cet e-mail pour écrire au client.' : ''}</p></div>`;

  const info = await transport.sendMail({
    from: config.mailFrom,
    to: config.mailTo,
    replyTo: d.email ? { name: oneLine(d.nom), address: d.email } : undefined,
    subject: oneLine(`Demande de devis - ${d.projet || 'Projet'} - ${d.nom}`).slice(0, 180),
    text,
    html,
  });
  if (!configured) console.log('[mail non envoyé : SMTP non configuré]\n' + text);
  return info;
}

module.exports = { sendContact, transport, configured };
