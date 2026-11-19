# ShopSphere - Module 6

## Démarrer l'application

Node.js 22 ou plus et MongoDB sont nécessaires. La connexion locale utilise par défaut `mongodb://127.0.0.1:27017/shopsphere`. Définissez `MONGODB_URI` uniquement si MongoDB utilise une autre adresse, et définissez `JWT_SECRET`, puis lancez :

```powershell
npm install
npm start
```

Le serveur écoute sur le port `3000` par défaut. `PORT` permet de le modifier. Aucun fichier `.env` n'est créé ou modifié.

Exemple PowerShell (variables limitées à la fenêtre courante) :

```powershell
$env:JWT_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
npm start
```

Pour remplacer l'URI locale : `$env:MONGODB_URI = "mongodb://serveur:27017/shopsphere"`. MongoDB doit être démarré avant `npm start`.

## Créer un compte administrateur

1. Inscrivez d'abord le compte avec `POST /api/auth/inscription`.
2. Définissez `ADMIN_EMAIL` sur son adresse et lancez `npm run promote-admin`.
3. Connectez-vous via `POST /api/auth/connexion` pour obtenir le jeton admin.

La promotion s'effectue uniquement en ligne de commande ; l'inscription publique ne permet pas de choisir le rôle administrateur.

## Données d'essai

Les modèles `Product` et `Order` constituent le socle minimal utilisé par le module. Après l'inscription du client, le script `npm run seed-demo` crée un produit et une commande livrée pour `CLIENT_EMAIL`, puis affiche les identifiants à copier dans Postman.

## Postman

Importer `postman/module6.postman_collection.json`. Inscrire `clientEmail` une première fois, puis lancer `seed-demo` pour cette adresse. Définir aussi `ADMIN_EMAIL` et lancer la promotion admin ; renseigner `adminEmail`/`adminPassword` ainsi que `productId`/`orderId` dans Postman. La collection mémorise les jetons et identifiants créés.

## Vérification

```powershell
npm test
```
