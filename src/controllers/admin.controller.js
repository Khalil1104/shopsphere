'use strict';

const adminService = require('../services/adminService');

module.exports = {
  async list(req, res) {
    res.json(await adminService.list(req.validated.query));
  },
  async getOne(req, res) {
    res.json(await adminService.getById(req.params.id));
  },
  async create(req, res) {
    res.status(201).json({ message: 'Administrateur créé', admin: await adminService.create(req.body) });
  },
  async update(req, res) {
    res.json(await adminService.update(req.params.id, req.body, req.auth.id));
  },
  async remove(req, res) {
    await adminService.remove(req.params.id, req.auth.id);
    res.status(204).end();
  },
  // --- Profil de l'admin connecté ---
  async getMe(req, res) {
    res.json(req.user);
  },
  async updateMe(req, res) {
    res.json(await adminService.update(req.auth.id, req.body, req.auth.id));
  }
};
