'use strict';

const Birthday = require('../models/Birthday');

/** GET /api/birthday/active — Public */
async function getActive(req, res, next) {
    try {
        const rows = await Birthday.find({ is_active: true }).sort({ created_at: -1 });
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

/** GET /api/birthday — Admin */
async function getAll(req, res, next) {
    try {
        const rows = await Birthday.find().sort({ created_at: -1 });
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

/** POST /api/birthday — Admin */
async function create(req, res, next) {
    try {
        const { title, content, is_active } = req.body;
        const row = await Birthday.create({ title, content, is_active });
        res.status(201).json(row);
    } catch (err) {
        next(err);
    }
}

/** PUT /api/birthday/:id — Admin */
async function update(req, res, next) {
    try {
        const { id } = req.params;
        const row = await Birthday.findByIdAndUpdate(id, req.body, { new: true });
        if (!row) return res.status(404).json({ error: 'Birthday entry not found.' });
        res.json(row);
    } catch (err) {
        next(err);
    }
}

/** DELETE /api/birthday/:id — Admin */
async function remove(req, res, next) {
    try {
        const { id } = req.params;
        const row = await Birthday.findByIdAndDelete(id);
        if (!row) return res.status(404).json({ error: 'Birthday entry not found.' });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

module.exports = { getActive, getAll, create, update, remove };
