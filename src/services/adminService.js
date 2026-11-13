'use strict';

const AppError = require('../utils/AppError');
const Admin = require('../models/Admin');
const { hashPassword } = require('../utils/security');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function list({ page, limit, search, status }) {
  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }
  if (status) filter.accountStatus = status;
  const [items, total] = await Promise.all([
    Admin.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Admin.countDocuments(filter)
  ]);
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function getById(id) {
  const admin = await Admin.findById(id);
  if (!admin) throw AppError.notFound('Administrateur introuvable');
  return admin;
}

async function create(data) {
  return Admin.create({ ...data, password: await hashPassword(data.password) });
}

/** Garde-fou : il doit toujours rester au moins un administrateur actif. */
async function assertNotLastActiveAdmin(id) {
  const others = await Admin.countDocuments({ _id: { $ne: id }, accountStatus: 'ACTIVE' });
  if (others === 0) throw AppError.conflict('Impossible : il doit rester au moins un administrateur actif');
}

async function update(id, data, currentAdminId) {
  if (data.accountStatus === 'SUSPENDED') {
    if (String(id) === String(currentAdminId)) throw AppError.forbidden('Vous ne pouvez pas suspendre votre propre compte');
    await assertNotLastActiveAdmin(id);
  }
  const update = { $set: { ...data } };
  if (data.accountStatus === 'SUSPENDED') Object.assign(update.$set, { sessions: [], suspendedForFailedLogins: false });
  if (data.accountStatus === 'ACTIVE') Object.assign(update.$set, { failedLoginAttempts: 0, suspendedForFailedLogins: false });
  const admin = await Admin.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
  if (!admin) throw AppError.notFound('Administrateur introuvable');
  return admin;
}

async function remove(id, currentAdminId) {
  if (String(id) === String(currentAdminId)) throw AppError.forbidden('Vous ne pouvez pas supprimer votre propre compte');
  await getById(id);
  await assertNotLastActiveAdmin(id);
  await Admin.findByIdAndDelete(id);
}

module.exports = { list, getById, create, update, remove };
