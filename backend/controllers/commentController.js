const { body, param, validationResult } = require('express-validator');
const { User, Comment, Template, TemplatePermission } = require('../models');

const addComment = [
  param('template_id').isInt().withMessage('Invalid template ID'),
  body('content').trim().notEmpty().withMessage('Comment content cannot be empty'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const template_id = parseInt(req.params.template_id, 10);
      const user_id = req.user.id;
      const content = req.body.content.trim();

      const template = await Template.findByPk(template_id);
      if (
        !template ||
        (!template.is_public &&
          !(await TemplatePermission.findOne({ where: { template_id, user_id } })))
      ) {
        console.log(`❌ AddComment failed: No access to template ${template_id} for user ${user_id}`);
        return res.status(403).json({ success: false, message: 'No access to this template' });
      }

      const comment = await Comment.create({
        template_id,
        user_id,
        content,
        created_at: new Date(),
      });

      const commentWithUser = await Comment.findByPk(comment.id, {
        include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      });

      console.log(`✅ Comment added: Template ID ${template_id}, User ID ${user_id}`);
      return res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        comment: commentWithUser,
      });
    } catch (error) {
      console.error('❌ Error adding comment:', { template_id: req.params.template_id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.',
        error: error.message,
      });
    }
  },
];

const getComments = [
  param('template_id').isInt().withMessage('Invalid template ID'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const template_id = parseInt(req.params.template_id, 10);
      const template = await Template.findByPk(template_id);
      if (
        !template ||
        (!template.is_public &&
          !(await TemplatePermission.findOne({ where: { template_id, user_id: req.user.id } })))
      ) {
        console.log(`❌ GetComments failed: No access to template ${template_id} for user ${req.user.id}`);
        return res.status(403).json({ success: false, message: 'No access to this template' });
      }

      const comments = await Comment.findAll({
        where: { template_id },
        include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
        order: [['created_at', 'DESC']],
      });

      console.log(`✅ Fetched ${comments.length} comments for Template ID ${template_id}`);
      return res.json({ success: true, comments });
    } catch (error) {
      console.error('❌ Error fetching comments:', { template_id: req.params.template_id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

module.exports = { addComment, getComments };