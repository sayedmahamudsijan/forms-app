const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const integrationsController = require('../controllers/integrationsController');

// Salesforce Sync
router.post('/salesforce/sync', authMiddleware, integrationsController.syncSalesforce);

// Odoo Token Generation
router.post('/odoo/token', authMiddleware, integrationsController.generateOdooToken);

// Power Automate Support Ticket
router.post('/support/ticket', authMiddleware, integrationsController.createSupportTicket);

module.exports = router;
