const express = require('express');
const { createTemplate, getTemplates, updateTemplate, searchTemplates, deleteTemplate, getTemplate, getResults } = require('../controllers/templateController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/templates
 * Public route
 * Supports optional query params:
 *   - ?latest=true
 *   - ?top=5
 *   - ?user=true (requires auth)
 */
router.get('/', (req, res, next) => {
  console.log(`✅ Accessing GET /api/templates for User ID ${req.user?.id || 'unauthenticated'}`, {
    query: req.query,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getTemplates(req, res, next);
});

/**
 * GET /api/templates/:id
 * Public for is_public templates, protected otherwise
 */
router.get('/:id', ...getTemplate);

/**
 * GET /api/templates/:id/results
 * Protected route to fetch template results
 */
router.get('/:id/results', authMiddleware, ...getResults);

/**
 * GET /api/templates/search
 * Protected route for full-text search
 */
router.get('/search', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/templates/search for User ID ${req.user.id}`, {
    query: req.query,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  searchTemplates(req, res, next);
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', authMiddleware, createTemplate);

/**
 * PUT /api/templates/:id
 * Update an existing template
 */
router.put('/:id', authMiddleware, updateTemplate);

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', authMiddleware, deleteTemplate);

module.exports = router;