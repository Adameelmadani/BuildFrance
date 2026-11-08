#!/usr/bin/env node
/* BUILD FRANCE - vérifie la configuration SMTP et envoie un e-mail de test à MAIL_TO
   npm run test-mail */
'use strict';
const config = require('../server/config');
const { transport, configured } = require('../server/mailer');

(async () => {
  if (!configured) {
    console.error('SMTP non configuré : renseignez SMTP_HOST, SMTP_USER et SMTP_PASS dans le fichier .env.');
    process.exit(1);
  }
  console.log(`Connexion à ${config.smtp.host}:${config.smtp.port} en tant que ${config.smtp.user}…`);
  try {
    await transport.verify();
    console.log('Connexion et identifiants SMTP : OK');
    const info = await transport.sendMail({
      from: config.mailFrom,
      to: config.mailTo,
      subject: 'Test - formulaire du site BUILD FRANCE',
      text: `Cet e-mail confirme que le site peut envoyer les demandes de devis à ${config.mailTo}.\nEnvoyé le ${new Date().toLocaleString('fr-FR')}.`,
    });
    console.log(`E-mail de test envoyé à ${config.mailTo} (${info.messageId}). Vérifiez la boîte de réception (et les spams).`);
    process.exit(0);
  } catch (e) {
    console.error('Échec : ' + e.message);
    if (/Invalid login|535|Username and Password not accepted/i.test(e.message)) {
      console.error("Identifiants refusés. Avec Gmail, SMTP_PASS doit être un « mot de passe d'application » (voir README).");
    }
    process.exit(1);
  }
})();
