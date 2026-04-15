'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const { errorHandler } = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/auth');
const announcementsRoutes = require('./routes/announcements');
const menuRoutes = require('./routes/menu');
const eventsRoutes = require('./routes/events');
const tickerRoutes = require('./routes/ticker');
const birthdayRoutes = require('./routes/birthday');

const app = express();

// ── Serverless-friendly Database Connection Middleware ──────────────────────────
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('Database connection failed:', err);
        res.status(503).json({ error: 'Database service unavailable' });
    }
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    'http://localhost:4173',   // vite preview
    'http://localhost:3001',   // same-origin when served statically
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/ticker', tickerRoutes);
app.use('/api/birthday', birthdayRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

// ── Start (local dev only) ────────────────────────────────────────────────────
// In production (Vercel), the app is exported below and Vercel handles invocation.
// When run directly with `node server.js` or `npm run dev`, start the HTTP server.
if (require.main === module) {
    const PORT = parseInt(process.env.PORT || '3001', 10);
    app.listen(PORT, () => {
        console.log(`✅  WeonScreen API running on http://localhost:${PORT}`);
    });
}

module.exports = app;
