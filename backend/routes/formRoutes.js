const express = require('express');
const { submitForm, getFormResults, getUserForms } = require('../controllers/formController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * POST /api/forms
 * Submit a new form
 */
router.post('/', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing POST /api/forms for User ID ${req.user?.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  submitForm(req, res, next);
});

/**
 * GET /api/forms/:template_id/results
 * Get form results for a specific template (admin or template owner)
 */
router.get('/:template_id/results', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/forms/:template_id/results for User ID ${req.user?.id}`, {
    template_id: req.params.template_id,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getFormResults(req, res, next);
});

/**
 * GET /api/forms/owned/results
 * Get all forms submitted by the authenticated user
 */
router.get('/owned/results', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/forms/owned/results for User ID ${req.user?.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getUserForms(req, res, next);
});

module.exports = router;