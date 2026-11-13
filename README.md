# ShopSphere v2 — Clients & Admins

Module utilisateurs simple de ShopSphere : **2 collections MongoDB** (`clients`, `admins`), **CRUD**, **connexion JWT** et **e-mails** (bienvenue, vérification, mot de passe oublié, changement de statut).

Inclus aussi, **sans collection supplémentaire** :
- **Sessions** : chaque connexion est enregistrée dans le compte (tableau `sessions`) ; liste des appareils, déconnexion d'un appareil, de tous les appareils.
- **Suspension automatique** après 5 mots de passe faux, avec e-mail et lien de réactivation.
- **Statistiques** pour l'administrateur.
- **Double authentification (2FA)** : code à 6 chiffres envoyé par e-mail après le mot de passe (clients et admins, API et dashboard).
- **CAPTCHA** sur la page de connexion du dashboard (image SVG générée par le serveur, sans service externe).
- **Face ID / Windows Hello** pour les administrateurs (norme WebAuthn) : connexion sans mot de passe depuis le dashboard.

Et un **tableau de bord administrateur** rendu côté serveur (Express + EJS) : `http://localhost:3001/admin`.

## Technologies

Node.js 20+ · Express 5 · MongoDB + Mongoose · Joi · bcrypt · JSON Web Token · Nodemailer · EJS · SimpleWebAuthn (Face ID) · svg-captcha · Jest + Supertest

## Structure

```
shopsphere-v2/
├── src/
│   ├── server.js              démarrage (MongoDB puis serveur)
│   ├── app.js                 assemblage Express
│   ├── config/                env.js (.env vérifié), database.js
│   ├── models/                Client.js, Admin.js  ← les 2 collections (+ accountFields.js : champs communs, sessions)
│   ├── validators/schemas.js  règles Joi de chaque requête
│   ├── middlewares/           auth (JWT), validate, errorHandler, rateLimit
│   ├── services/              logique : authService (+ 2FA), sessionService, webauthnService (Face ID), clientService, adminService, statsService, emailService
│   ├── controllers/           reçoivent la requête, appellent le service, répondent
│   ├── routes/                auth, client, admin
│   ├── templates/emails.js    les modèles d'e-mails
│   ├── dashboard/             tableau de bord : router.js, session.js (cookie + CSRF), captcha.js, charts.js (SVG), views/ (EJS), public/ (CSS, JS, faceid.js)
│   ├── automations/           tasks.js (les 4 automations), index.js (planificateur), store.js (data/automations.json)
│   └── utils/                 AppError, security (bcrypt, JWT, jetons, codes 2FA), memoryStore (CAPTCHA / défis Face ID), page (pages HTML des liens)
├── scripts/                   create-admin.js (premier admin), seed-demo.js (30 clients fictifs)
├── tests/                     67 tests Jest
└── docs/ShopSphere-v2.postman_collection.json
```

## Installation

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Copier `.env.example` en `.env`, puis compléter :
   - `MONGODB_URI=mongodb://127.0.0.1:27017/shopsphere_users`
   - `JWT_SECRET` : générer un secret avec
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
   - `SMTP_USER`, `SMTP_PASS` (mot de passe d'application Gmail), `MAIL_FROM`
3. Créer le premier administrateur :
   ```bash
   npm run admin:create -- --email admin@shopsphere.tn --password Admin2026X --first Mohamed --last Felhi
   ```
4. Démarrer :
   ```bash
   npm run dev
   ```
   → `Serveur démarré sur http://localhost:3001`
5. Lancer les tests (base MongoDB temporaire en mémoire, aucun e-mail envoyé) :
   ```bash
   npm test
   ```

## Tableau de bord (`/admin`)

1. `npm run dev`, puis ouvrir **http://localhost:3001/admin** et se connecter avec un compte admin.
2. Pour voir des chiffres tout de suite : `npm run demo:seed` (30 clients fictifs en `@example.com`, aucun e-mail envoyé ; mot de passe `Demo2026Pass`).

| Page | Contenu |
| --- | --- |
| Vue d'ensemble | Indicateurs, courbe des inscriptions (7 / 30 jours), santé des comptes, comptes à traiter, dernières inscriptions, villes, état des automations |
| Clients | Liste avec recherche, filtres (vérifiés, en attente, suspendus), tri et pagination |
| Tableau des clients | 3 colonnes ; glisser une carte vers « Suspendus » suspend le compte (e-mail envoyé), vers « Actifs » le réactive |
| Fiche client | Modifier, suspendre avec motif, réactiver, renvoyer le lien de vérification, voir et fermer ses sessions, supprimer |
| Administrateurs | Liste, création, modification, suspension, suppression |
| Automations | Activer / désactiver, « Lancer maintenant », historique |
| Mon compte | Profil et appareils connectés |
| Commandes, Produits, Catégories, Paiements, Stock | Pages prévues pour les autres services (bientôt) |

Sécurité du dashboard : JWT de la session admin dans un **cookie httpOnly** (`SameSite=Strict`, chemin `/admin`), **jeton CSRF** sur chaque formulaire, mêmes règles que l'API (5 échecs → suspension). Il appelle directement les services : aucune logique dupliquée, Postman et l'API ne changent pas.

## Automations

| Automation | Quand | Par défaut |
| --- | --- | --- |
| Rappel de vérification | tous les jours à 10:00 — clients non vérifiés depuis plus de 24 h, un seul rappel | activée |
| Rapport quotidien | tous les jours à 08:00 — e-mail de synthèse aux admins actifs | activée |
| Nettoyage des comptes non vérifiés | tous les jours à 03:00 — supprime les comptes non vérifiés de plus de 7 jours | **désactivée** |
| Alerte sécurité | à chaque suspension automatique (5 échecs) — e-mail aux admins | activée |

L'état (activée / désactivée, historique) est gardé dans `data/automations.json` : aucune collection MongoDB en plus. Au tout premier démarrage, les tâches dont l'heure est déjà passée attendent le lendemain.

## Routes

| Méthode | Route | Accès | Rôle |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Inscription client + e-mails bienvenue et vérification |
| POST | `/api/auth/login` | public | Connexion client → JWT |
| POST | `/api/auth/admin/login` | public | Connexion admin → JWT |
| GET | `/api/auth/me` | connecté | Utilisateur du jeton |
| POST | `/api/auth/2fa/verify` | public | Code reçu par e-mail + `challengeToken` → JWT |
| POST | `/api/auth/2fa/enable` | connecté | Activer la 2FA (mot de passe demandé) |
| POST | `/api/auth/2fa/disable` | connecté | Désactiver la 2FA (mot de passe demandé) |
| GET | `/api/auth/sessions` | connecté | Mes appareils connectés |
| DELETE | `/api/auth/sessions/:sid` | connecté | Déconnecter un appareil |
| POST | `/api/auth/logout` | connecté | Déconnexion (ce jeton devient inutilisable) |
| POST | `/api/auth/logout-all` | connecté | Déconnecter tous les appareils |
| GET | `/api/auth/verify-email?token=` | lien e-mail | Vérifie l'adresse |
| POST | `/api/auth/resend-verification` | public | Renvoie le lien |
| POST | `/api/auth/forgot-password` | public | E-mail de réinitialisation (`type`: client / admin) |
| GET | `/api/auth/reset-password?token=&type=` | lien e-mail | Formulaire « nouveau mot de passe » |
| POST | `/api/auth/reset-password` | public | Enregistre le nouveau mot de passe |
| GET / PATCH / DELETE | `/api/clients/me` | client | Son propre profil |
| GET / PATCH | `/api/admin/me` | admin | Profil de l'admin connecté |
| GET | `/api/admin/stats?days=7` | admin | Statistiques |
| GET / POST | `/api/admin/clients` | admin | Lister (pagination, recherche, statut) / créer |
| GET / PATCH / DELETE | `/api/admin/clients/:id` | admin | Lire / modifier / supprimer |
| PATCH | `/api/admin/clients/:id/status` | admin | Suspendre / réactiver + e-mail |
| GET / POST | `/api/admin/admins` | admin | Lister / créer |
| GET / PATCH / DELETE | `/api/admin/admins/:id` | admin | Lire / modifier / supprimer |

## Sécurité en place

- Mots de passe hachés avec **bcrypt** ; jamais renvoyés (`select: false` + `toJSON`).
- **JWT** signé (HS256) contenant l'identifiant de session `sid` ; à chaque requête le compte est relu en base et la session doit exister : un compte suspendu, supprimé ou une session fermée (logout) est bloqué immédiatement.
- **Sessions dans le document** (max 10 par compte, les expirées sont supprimées) ; fermées automatiquement à la suspension et au changement de mot de passe.
- **5 mots de passe faux → compte suspendu** (compteur atomique `$inc`), sessions fermées, e-mail avec lien de réactivation ; un compte suspendu par un admin ne peut pas être réactivé par « mot de passe oublié ».
- Jetons des liens e-mail aléatoires (256 bits), stockés **hachés** (SHA-256), avec expiration et usage unique.
- **Joi** refuse tout champ inattendu (`"role": "ADMIN"` → 400).
- Même réponse si un e-mail existe ou non (connexion, mot de passe oublié) : pas d'énumération des comptes.
- Limitation des tentatives (50 / 15 min par IP) sur les routes d'authentification, en-têtes **helmet**.
- Garde-fous admin : impossible de se supprimer / se suspendre soi-même ou de supprimer le dernier admin actif.
- **2FA par e-mail** : si elle est active, `login` renvoie `twoFactorRequired` et un `challengeToken` (10 min) au lieu du JWT. Le code (6 chiffres, `crypto.randomInt`) est stocké **haché**, sert une seule fois, et 5 codes faux l'annulent. Le `challengeToken` est signé avec une clé dérivée : il est refusé par toutes les autres routes.
- **CAPTCHA** du dashboard : la réponse reste dans le serveur (mémoire, 5 min, usage unique) ; le navigateur ne reçoit que l'image et un identifiant dans un cookie httpOnly. Désactivable avec `CAPTCHA_ENABLED=false`.
- **Face ID (WebAuthn)** : seule la clé **publique** est stockée dans le document admin (`webauthnCredentials`) ; la clé privée reste dans le PC (Windows Hello). Vérification du visage / empreinte obligatoire, défi aléatoire à usage unique, compteur de signatures, lié au domaine de `APP_URL`.

## Face ID (Windows Hello)

1. Ouvrir le dashboard à l'adresse exacte de `APP_URL` (ex. `http://localhost:3001/admin`, pas `127.0.0.1`).
2. Se connecter avec le mot de passe, aller dans **Mon compte → Face ID → Enregistrer cet appareil**, valider avec Windows Hello (visage, empreinte ou code PIN).
3. Se déconnecter : sur la page de connexion, **Se connecter avec Face ID** suffit.

Face ID ne fonctionne pas dans Postman : il a besoin du navigateur (`navigator.credentials`) et de Windows Hello.
