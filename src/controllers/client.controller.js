'use strict';

const clientService = require('../services/clientService');
const Client = require('../models/Client');

module.exports = {
  // --- CRUD par l'administrateur (/api/admin/clients) ---
  async list(req, res) {
    res.json(await clientService.list(req.validated.query));
  },
  async getOne(req, res) {
    res.json(await clientService.getById(req.params.id));
  },
  async create(req, res) {
    const client = await clientService.create(req.body);
    res.status(201).json({ message: 'Client créé. E-mails de bienvenue et de vérification envoyés.', client });
  },
  async update(req, res) {
    res.json(await clientService.update(req.params.id, req.body));
  },
  async updateStatus(req, res) {
    const client = await clientService.updateStatus(req.params.id, req.body);
    res.json({ message: `Statut mis à jour : ${client.accountStatus}. Le client a été prévenu par e-mail.`, client });
  },
  async remove(req, res) {
    await clientService.remove(req.params.id);
    res.status(204).end();
  },

  // --- Espace du client connecté (/api/clients/me) ---
  async getMe(req, res) {
    res.json(req.user);
  },
  async updateMe(req, res) {
    res.json(await clientService.update(req.auth.id, req.body));
  },
  async deleteMe(req, res) {
    await Client.findByIdAndDelete(req.auth.id);
    res.status(204).end();
  }
};
