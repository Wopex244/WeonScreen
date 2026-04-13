'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains.
 * If there are validation errors, returns 422 with the details.
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

/**
 * Centralized error handler.
 * Must be registered LAST in the Express middleware chain.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    console.error('[Error Details]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        path: req.path,
        method: req.method
    });

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        return res.status(409).json({ error: 'A record with that value already exists.' });
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        return res.status(422).json({ error: err.message, details: err.errors });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(status).json({ 
        error: message,
        // Provide enough info for the user to troubleshoot without exposing too much
    });
}

module.exports = { handleValidationErrors, errorHandler };
