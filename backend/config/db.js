'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI is not defined in .env');
}

let cachedConnection = null;

const connectDB = async () => {
    if (cachedConnection) {
        return cachedConnection;
    }

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined. Please check your environment variables.');
    }

    try {
        const db = await mongoose.connect(MONGODB_URI, {
            // Options can be added here if needed
        });
        cachedConnection = db;
        console.log('✅  MongoDB connected successfully');
        return db;
    } catch (err) {
        console.error('❌  MongoDB connection error:', err.message);
        throw err; // Rethrow to let the caller handle it (e.g., via middleware or global error handler)
    }
};

module.exports = connectDB;
