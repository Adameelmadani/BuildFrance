# BUILD FRANCE - Site vitrine

Site internet de **BUILD FRANCE SAS** (construction, maçonnerie, rénovation, aménagement - Nîmes) :
trois pages (Présentation, Domaines de compétences, Nous contacter) et un petit serveur Node.js qui reçoit les demandes de devis du formulaire et les envoie par e-mail.

- **Pages** : HTML / CSS / JavaScript, sans étape de compilation, dans [`public/`](public/)
- **Serveur** : Node.js + Express, dans [`server/`](server/)
- **E-mails** : SMTP via Nodemailer (Gmail ou tout autre fournisseur)
- **Mise en ligne** : Ubuntu / Debian + Node.js 22 + systemd + Nginx + Let's Encrypt, **sans Docker**

---

## Sommaire

1. [Fonctionnement](#fonctionnement)
2. [Structure du projet](#structure-du-projet)
3. [Lancer le site sur votre PC](#lancer-le-site-sur-votre-pc)
4. [Mise en ligne sur un serveur](#mise-en-ligne-sur-un-serveur)
5. [Envoi des e-mails (Gmail)](#envoi-des-e-mails-gmail)
6. [Héberger aussi l'application de gestion sur le même serveur](#héberger-aussi-lapplication-de-gestion-sur-le-même-serveur)
7. [Consulter les demandes reçues](#consulter-les-demandes-reçues)
8. [Modifier le site et le mettre à jour](#modifier-le-site-et-le-mettre-à-jour)
9. [Configuration (.env)](#configuration-env)
10. [Dépannage](#dépannage)
11. [Sécurité](#sécurité)
12. [À faire avant la mise en ligne](#à-faire-avant-la-mise-en-ligne)

---

## Fonctionnement

```
Visiteur ──HTTPS──▶ Nginx (:443, certificat Let's Encrypt)
                        │
                        ▼
              Node.js / Express  127.0.0.1:3100   (service systemd « buildfrance-site »)
                ├─ /, /domaines, /contact, /assets/…   pages et images (dossier public/)
                └─ POST /api/contact                   formulaire de devis
                        │
                        ├─▶ 1. enregistre la demande dans data/messages.jsonl
                        └─▶ 2. l'envoie par e-mail à MAIL_TO (SMTP)
```

Quand un visiteur envoie le formulaire :

1. Les champs sont vérifiés dans le navigateur, puis **à nouveau sur le serveur** (nom, téléphone, e-mail, message, accord RGPD).
2. La demande est **toujours enregistrée** dans `data/messages.jsonl` : rien n'est perdu, même si l'envoi de l'e-mail échoue.
3. Un e-mail est envoyé à `buildfrance.sas@gmail.com`. Il contient toutes les informations et un bouton « Appeler ». Si le visiteur a donné son e-mail, il suffit de cliquer sur **Répondre** pour lui écrire.
4. Le visiteur voit « Merci, votre demande a bien été envoyée » avec une référence (ex. `20261108-77de1b`), qui se retrouve aussi dans l'e-mail.

Protection anti-spam, sans captcha :

- un champ piège invisible : les robots le remplissent, les humains ne le voient pas ;
- le rejet des formulaires envoyés en moins de 3 secondes ;
- au maximum 5 demandes par adresse IP et par quart d'heure.

---

## Structure du projet

```
public/                  Tout ce qui est visible sur internet
  index.html             Présentation (accueil)
  domaines.html          Domaines de compétences
  contact.html           Nous contacter + formulaire + mentions légales
  404.html               Page « introuvable »
  assets/css/site.css    Styles (même charte que l'application de gestion)
  assets/js/site.js      Animations, menu mobile, envoi du formulaire
  assets/img/            Logos
  assets/img/photos/     Photos (Unsplash, format WebP)
server/
  index.js               Serveur : pages, API /api/contact, sécurité, anti-spam
  mailer.js              Construction et envoi de l'e-mail
  config.js              Lecture de la configuration (.env)
scripts/
  test-mail.js           Vérifie la configuration SMTP et envoie un e-mail de test
deploy/
  buildfrance-site.service      Service systemd
  nginx-buildfrance-site.conf   Configuration Nginx
.env.example             Modèle de configuration
Infos.txt                Notes sur l'entreprise (jamais servi sur internet)
```

Seul le dossier `public/` est accessible depuis internet. `.env`, `Infos.txt`, `data/` et le code du serveur ne le sont pas.

---

## Lancer le site sur votre PC

Il faut **Node.js 22 ou plus récent** ([nodejs.org](https://nodejs.org)).

```bash
npm install
```

```bash
npm start
```

Ouvrez <http://127.0.0.1:3100>.

Sans fichier `.env`, aucun e-mail n'est envoyé : les demandes du formulaire **s'affichent dans le terminal** et sont enregistrées dans `data/messages.jsonl`. C'est pratique pour tester sans rien configurer.
Pour tester le vrai envoi, créez le `.env` (voir [Envoi des e-mails](#envoi-des-e-mails-gmail)) puis lancez `npm run test-mail`.

`npm run dev` relance automatiquement le serveur à chaque modification d'un fichier de `server/`.

---

## Mise en ligne sur un serveur

Étapes pour **Ubuntu 22.04 / 24.04 ou Debian 12** sur un VPS (OVH, Scaleway, Hetzner, IONOS…). 1 vCPU et 1 Go de RAM suffisent largement.
Les commandes se lancent avec un utilisateur qui a les droits `sudo`. Remplacez `buildfrance.fr` par votre nom de domaine.

> Le serveur héberge déjà l'application de gestion des devis ? Les étapes 1 et 2 sont déjà faites : passez à l'étape 3, et lisez aussi [cette section](#héberger-aussi-lapplication-de-gestion-sur-le-même-serveur).

### 0. Avant de commencer

- Un serveur accessible en SSH.
- Un nom de domaine (ex. `buildfrance.fr`), avec chez votre registrar (OVH, Gandi, IONOS…) deux **enregistrements A** vers l'adresse IP du serveur : `buildfrance.fr` et `www.buildfrance.fr`.
  Vérifiez avec `ping buildfrance.fr` que le nom pointe bien vers le serveur avant l'étape 8.

### 1. Mettre le système à jour et ouvrir le pare-feu

```bash
sudo apt update && sudo apt upgrade -y
```

```bash
sudo apt install -y git nginx ufw
```

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Le port 3100 (Node) reste fermé vers l'extérieur : seul Nginx lui parle.

### 2. Installer Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt install -y nodejs
```

```bash
node -v
```

La commande doit afficher `v22.x` ou plus.

### 3. Créer un utilisateur dédié et récupérer le site

Le site tourne sous un compte système sans shell, qui ne peut écrire que dans `data/`.

```bash
sudo useradd --system --home /opt/buildfrance-site --shell /usr/sbin/nologin buildfrance-site
```

```bash
sudo git clone <URL-DE-CE-DEPOT> /opt/buildfrance-site
```

Pas d'accès Git depuis le serveur ? Copiez le dossier du projet dans `/opt/buildfrance-site`, sans `node_modules/` ni `data/`, par exemple avec WinSCP ou `scp -r`.

```bash
cd /opt/buildfrance-site && sudo npm ci --omit=dev
```

```bash
sudo mkdir -p /opt/buildfrance-site/data && sudo chown buildfrance-site:buildfrance-site /opt/buildfrance-site/data && sudo chmod 700 /opt/buildfrance-site/data
```

### 4. Configurer

```bash
sudo cp /opt/buildfrance-site/.env.example /opt/buildfrance-site/.env
```

```bash
sudo nano /opt/buildfrance-site/.env
```

Renseignez au minimum `SMTP_PASS` : c'est le mot de passe d'application Gmail (voir [Envoi des e-mails](#envoi-des-e-mails-gmail)). Les autres valeurs par défaut conviennent. Enregistrez avec `Ctrl+O`, `Entrée`, puis quittez avec `Ctrl+X`.

Protégez ensuite le fichier, qui contient un mot de passe :

```bash
sudo chown root:buildfrance-site /opt/buildfrance-site/.env && sudo chmod 640 /opt/buildfrance-site/.env
```

### 5. Tester l'envoi d'e-mail

```bash
cd /opt/buildfrance-site && sudo -u buildfrance-site node scripts/test-mail.js
```

Le résultat attendu est `Connexion et identifiants SMTP : OK` puis `E-mail de test envoyé…`. Vérifiez que l'e-mail est bien arrivé dans `buildfrance.sas@gmail.com`, et regardez aussi dans les spams.

### 6. Démarrer le site comme service

```bash
sudo cp /opt/buildfrance-site/deploy/buildfrance-site.service /etc/systemd/system/buildfrance-site.service
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now buildfrance-site
```

```bash
sudo systemctl status buildfrance-site
```

Le statut doit indiquer `active (running)`. Le site redémarre tout seul en cas de plantage et au démarrage du serveur. Vérification :

```bash
curl -s http://127.0.0.1:3100/api/health
```

La réponse attendue est `{"ok":true,"smtp":true}`. Si vous voyez `"smtp":false`, le SMTP n'est pas configuré dans `.env`.

### 7. Brancher Nginx

```bash
sudo cp /opt/buildfrance-site/deploy/nginx-buildfrance-site.conf /etc/nginx/sites-available/buildfrance-site
```

```bash
sudo sed -i 's/buildfrance.fr/VOTRE-DOMAINE/g' /etc/nginx/sites-available/buildfrance-site
```

```bash
sudo ln -s /etc/nginx/sites-available/buildfrance-site /etc/nginx/sites-enabled/buildfrance-site && sudo rm -f /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Activer le HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

```bash
sudo certbot --nginx -d VOTRE-DOMAINE -d www.VOTRE-DOMAINE
```

Certbot installe le certificat, redirige automatiquement HTTP vers HTTPS et renouvelle le certificat tout seul. Pour tester le renouvellement : `sudo certbot renew --dry-run`.

### 9. Vérifier

Ouvrez `https://VOTRE-DOMAINE`, parcourez les trois pages, puis envoyez une demande de test depuis **Nous contacter**. Vous devez recevoir l'e-mail en quelques secondes.

---

## Envoi des e-mails (Gmail)

Gmail **n'accepte pas** le mot de passe normal du compte pour envoyer depuis un serveur. Il faut un **mot de passe d'application** (16 lettres) :

1. Connectez-vous au compte `buildfrance.sas@gmail.com` puis ouvrez <https://myaccount.google.com/security>.
2. Activez la **Validation en deux étapes** si ce n'est pas déjà fait (obligatoire pour l'étape suivante).
3. Ouvrez <https://myaccount.google.com/apppasswords>, donnez un nom (ex. « Site web ») et cliquez sur **Créer**.
4. Copiez les 16 lettres affichées, **sans les espaces**, dans `SMTP_PASS=` du fichier `.env`.

Configuration Gmail complète dans `.env` :

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=buildfrance.sas@gmail.com
SMTP_PASS=abcdefghijklmnop
MAIL_TO=buildfrance.sas@gmail.com
MAIL_FROM="Site BUILD FRANCE <buildfrance.sas@gmail.com>"
```

Après chaque modification du `.env`, redémarrez le site avec `sudo systemctl restart buildfrance-site`, puis relancez le test (étape 5).

**Autre fournisseur** (adresse e-mail à votre nom de domaine chez OVH, IONOS, Brevo…) : remplacez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASS` par les valeurs SMTP données par votre fournisseur. Avec le port 587, mettez `SMTP_SECURE=false` (la connexion passe quand même en chiffré, via STARTTLS).

> Certains hébergeurs bloquent l'envoi d'e-mails pour les nouveaux serveurs (ports 25, 465 et 587). Si `test-mail` reste bloqué sur `Connexion…` puis échoue avec `ETIMEDOUT`, demandez le déblocage au support de l'hébergeur.

---

## Héberger aussi l'application de gestion sur le même serveur

Les deux projets peuvent tourner sur la même machine sans conflit :

| | Site vitrine | Application de gestion |
| --- | --- | --- |
| Dossier | `/opt/buildfrance-site` | `/opt/buildfrance` |
| Service systemd | `buildfrance-site` | `buildfrance` |
| Port interne | `3100` | `3000` |
| Adresse conseillée | `buildfrance.fr`, `www.buildfrance.fr` | `gestion.buildfrance.fr` |

Chaque projet a sa propre configuration Nginx, avec son propre `server_name`. Créez un enregistrement DNS A supplémentaire pour `gestion.buildfrance.fr`, puis lancez `certbot` une fois pour chaque domaine.
Ne mettez **aucun lien** vers l'application de gestion sur le site public : elle est réservée à l'entreprise.

---

## Consulter les demandes reçues

Chaque demande est envoyée par e-mail **et** ajoutée, sur une ligne, à `/opt/buildfrance-site/data/messages.jsonl`. Ce fichier sert de filet de sécurité si un e-mail n'arrive pas.

Les 5 dernières demandes :

```bash
sudo tail -n 5 /opt/buildfrance-site/data/messages.jsonl
```

Retrouver une demande par sa référence :

```bash
sudo grep 20261108-77de1b /opt/buildfrance-site/data/messages.jsonl
```

Journal du site en direct (démarrage, demandes reçues, erreurs d'envoi) :

```bash
sudo journalctl -u buildfrance-site -f
```

En cas d'échec d'envoi, le journal affiche une ligne `ERREUR D'ENVOI DE L'E-MAIL pour la demande …`, et la demande reste dans `messages.jsonl`.

**RGPD** : les mentions légales annoncent une suppression des demandes au plus tard 3 ans après le dernier contact. Pensez à vider ou alléger ce fichier régulièrement.

---

## Modifier le site et le mettre à jour

- **Textes** : directement dans `public/index.html`, `public/domaines.html` et `public/contact.html`.
- **Photos** : dans `public/assets/img/photos/`. Pour remplacer une photo, gardez le même nom de fichier, ou modifiez le chemin dans la page.
- **Styles et scripts** : `public/assets/css/site.css` et `public/assets/js/site.js`. Après une modification, **augmentez le numéro de version** dans les trois pages (`site.css?v=3` → `?v=4`, pareil pour `site.js`). Sans ça, les navigateurs des visiteurs gardent l'ancienne version en cache pendant 24 h.

Publier les modifications sur le serveur :

```bash
cd /opt/buildfrance-site && sudo git pull && sudo npm ci --omit=dev
```

```bash
sudo systemctl restart buildfrance-site
```

Une modification qui ne touche que `public/` est visible immédiatement, même sans redémarrage.

---

## Configuration (.env)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Adresse d'écoute de Node. À garder derrière Nginx. |
| `PORT` | `3100` | Port de Node (doit correspondre au `proxy_pass` de Nginx). |
| `TRUST_PROXY` | `1` | Nombre de proxys devant Node. Sert à connaître la vraie IP du visiteur pour l'anti-spam. |
| `DATA_DIR` | `./data` | Dossier du fichier `messages.jsonl`. |
| `SMTP_HOST` | vide | Serveur SMTP (`smtp.gmail.com`). Vide = e-mails affichés dans le journal au lieu d'être envoyés. |
| `SMTP_PORT` | `465` | Port SMTP (465 = SSL, 587 = STARTTLS). |
| `SMTP_SECURE` | `true` | `true` pour le port 465, `false` pour le port 587. |
| `SMTP_USER` | vide | Identifiant SMTP (l'adresse Gmail). |
| `SMTP_PASS` | vide | Mot de passe d'application. |
| `MAIL_TO` | `buildfrance.sas@gmail.com` | Adresse qui reçoit les demandes (plusieurs adresses séparées par des virgules possibles). |
| `MAIL_FROM` | `SMTP_USER` | Expéditeur affiché. Avec Gmail, ce doit être la même adresse que `SMTP_USER`. |
| `TZ` | `Europe/Paris` | Fuseau horaire des dates dans les e-mails. |

Si vous changez `DATA_DIR`, mettez aussi à jour `ReadWritePaths=` dans `/etc/systemd/system/buildfrance-site.service`, puis lancez `sudo systemctl daemon-reload`.

---

## Dépannage

| Problème | Solution |
| --- | --- |
| **502 Bad Gateway** | Le service Node est arrêté : `sudo systemctl status buildfrance-site` et `sudo journalctl -u buildfrance-site -n 50`. |
| **`Invalid login` / `535` au test d'e-mail** | `SMTP_PASS` n'est pas un mot de passe d'application Gmail, ou il contient des espaces. Voir [Envoi des e-mails](#envoi-des-e-mails-gmail). |
| **`ETIMEDOUT` au test d'e-mail** | L'hébergeur bloque les ports SMTP : demandez le déblocage au support. |
| **Le formulaire répond « Trop de demandes envoyées »** | Plus de 5 envois en 15 minutes depuis la même adresse IP : attendez, ou redémarrez le service pour remettre le compteur à zéro. |
| **E-mails reçus dans les spams** | Marquez le premier comme « Non spam » dans Gmail. Avec une adresse à votre nom de domaine, configurez SPF/DKIM chez votre fournisseur. |
| **`EACCES` / impossible d'écrire dans `data/`** | Mauvais propriétaire du dossier : `sudo chown -R buildfrance-site:buildfrance-site /opt/buildfrance-site/data`. |
| **Une modification CSS ne s'affiche pas** | Augmentez le `?v=` dans les trois pages (voir [Modifier le site](#modifier-le-site-et-le-mettre-à-jour)), puis rechargez avec `Ctrl+F5`. |
| **La carte n'apparaît pas sur la page contact** | Le navigateur ou un bloqueur de publicité bloque Google Maps : sans gravité, l'adresse reste affichée en texte. |

---

## Sécurité

- Node n'écoute que sur `127.0.0.1` ; seul Nginx (ports 80/443) est exposé.
- Le service tourne sous un compte dédié, sans droits, qui ne peut écrire que dans `data/` (`ProtectSystem=strict`).
- En-têtes de sécurité envoyés sur chaque page : Content-Security-Policy stricte (scripts du site uniquement), `X-Frame-Options`, `nosniff`, `Referrer-Policy`.
- Formulaire : validation côté serveur, taille limitée à 20 Ko, champ piège anti-robots, limite de 5 envois par IP et par quart d'heure. Les retours à la ligne sont retirés des champs d'une ligne, pour empêcher l'injection d'en-têtes d'e-mail.
- Le site lui-même ne dépose aucun cookie. En revanche, la carte Google Maps intégrée à la page contact peut en déposer (cookies de Google).
- Pensez aux mises à jour du système (`sudo apt upgrade`), et éventuellement à `sudo apt install unattended-upgrades fail2ban`.

---

## À faire avant la mise en ligne

- [ ] Compléter l'**hébergeur** dans les mentions légales (`public/contact.html`, ligne « Hébergeur ») : nom, adresse et téléphone. C'est une obligation légale (article 6 de la LCEN).
- [ ] Créer le **mot de passe d'application Gmail** et lancer `test-mail`.
- [ ] Vérifier les textes : zone d'intervention, noms des dirigeants affichés sur la page d'accueil.
- [ ] Envoyer une vraie demande depuis le site en ligne et vérifier sa réception.
