const express = require('express');
const router = express.Router();
const integrationsController = require('../controllers/integrationsController');
const authenticateToken = require('../middleware/authMiddleware'); 

router.post('/salesforce/sync', authenticateToken, integrationsController.syncSalesforce);
router.post('/odoo/token', authenticateToken, integrationsController.generateOdooToken);

module.exports = router;
