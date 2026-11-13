'use strict';

/**
 * Crée le premier administrateur (aucune route publique ne permet de créer un admin).
 *
 *   npm run admin:create -- --email admin@shopsphere.tn --password "Admin2026!" --first Mohamed --last Felhi
 *
 * Les admins suivants sont créés depuis l'API : POST /api/admin/admins
 */
const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/database');
const Admin = require('../src/models/Admin');
const { hashPassword } = require('../src/utils/security');
const schemas = require('../src/validators/schemas');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

(async () => {
  const data = { email: arg('email'), password: arg('password'), firstName: arg('first') || 'Admin', lastName: arg('last') || 'ShopSphere' };
  const { error, value } = schemas.admins.create.body.validate(data, { abortEarly: false });
  if (error) {
    console.error('Données invalides :\n' + error.details.map((d) => `  - ${d.message}`).join('\n'));
    process.exit(1);
  }

  await connectDatabase();
  if (await Admin.exists({ email: value.email })) {
    console.error(`Un administrateur ${value.email} existe déjà.`);
  } else {
    const admin = await Admin.create({ ...value, password: await hashPassword(value.password) });
    console.log(`Administrateur créé : ${admin.email} (id ${admin._id})`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
