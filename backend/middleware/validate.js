'use strict';

const { body } = require('express-validator');

const announcements = {
    create: [
        body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
        body('content').trim().notEmpty().withMessage('Content is required'),
        body('image_url').optional({ nullable: true }).isURL().withMessage('image_url must be a valid URL'),
        body('is_active').optional().isBoolean(),
    ],
    update: [
        body('title').optional().trim().notEmpty().isLength({ max: 255 }),
        body('content').optional().trim().notEmpty(),
        body('image_url').optional({ nullable: true }).isURL().withMessage('image_url must be a valid URL'),
        body('is_active').optional().isBoolean(),
    ],
};

const menu = {
    create: [
        body('date').notEmpty().isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD)'),
        body('soup').optional({ nullable: true }).trim(),
        body('main_course').optional({ nullable: true }).trim(),
        body('side_dish').optional({ nullable: true }).trim(),
        body('dessert').optional({ nullable: true }).trim(),
    ],
    update: [
        body('date').optional().isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD)'),
        body('soup').optional({ nullable: true }).trim(),
        body('main_course').optional({ nullable: true }).trim(),
        body('side_dish').optional({ nullable: true }).trim(),
        body('dessert').optional({ nullable: true }).trim(),
    ],
};

const events = {
    create: [
        body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
        body('description').optional().trim(),
        body('media_url').optional({ nullable: true }).notEmpty().withMessage('media_url cannot be empty if provided'),
        body('media_type').optional().isIn(['image', 'video']).withMessage('media_type must be image or video'),
        body('is_active').optional().isBoolean(),
    ],
    update: [
        body('title').optional().trim().notEmpty().isLength({ max: 255 }),
        body('description').optional().trim(),
        body('media_url').optional({ nullable: true }).notEmpty().withMessage('media_url cannot be empty if provided'),
        body('media_type').optional().isIn(['image', 'video']).withMessage('media_type must be image or video'),
        body('is_active').optional().isBoolean(),
    ],
};

const ticker = {
    create: [
        body('message').trim().notEmpty().withMessage('Message is required'),
        body('is_active').optional().isBoolean(),
    ],
    update: [
        body('message').optional().trim().notEmpty(),
        body('is_active').optional().isBoolean(),
    ],
};

const birthday = {
    create: [
        body('title').trim().notEmpty().withMessage('Title is required'),
        body('content').trim().notEmpty().withMessage('Content is required'),
        body('is_active').optional().isBoolean(),
    ],
    update: [
        body('title').optional().trim().notEmpty(),
        body('content').optional().trim().notEmpty(),
        body('is_active').optional().isBoolean(),
    ],
};

const auth = {
    login: [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
};

module.exports = { announcements, menu, events, ticker, birthday, auth };
