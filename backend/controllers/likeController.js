const { param, validationResult } = require('express-validator');
const { Like, Template, TemplatePermission } = require('../models');

const toggleLike = [
  param('template_id').isInt().withMessage('Template ID must be an integer'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const template_id = parseInt(req.params.template_id, 10);
      const user_id = req.user.id;

      const template = await Template.findByPk(template_id);
      if (
        !template ||
        (!template.is_public &&
          !(await TemplatePermission.findOne({ where: { template_id, user_id } })))
      ) {
        console.log(`❌ ToggleLike failed: No access to template ${template_id} for user ${user_id}`);
        return res.status(403).json({ success: false, message: 'No access to this template' });
      }

      const existingLike = await Like.findOne({ where: { template_id, user_id } });
      if (existingLike) {
        await existingLike.destroy();
        console.log(`✅ Like removed: Template ID ${template_id}, User ID ${user_id}`);
        return res.json({ success: true, message: 'Like removed' });
      }

      await Like.create({ template_id, user_id });
      console.log(`✅ Like added: Template ID ${template_id}, User ID ${user_id}`);
      return res.status(201).json({ success: true, message: 'Like added' });
    } catch (error) {
      console.error('❌ Error toggling like:', { template_id: req.params.template_id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

module.exports = { toggleLike };