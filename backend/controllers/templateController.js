const { body, param, validationResult } = require('express-validator');
const { Sequelize, Op } = require('sequelize');
const {
  Template,
  TemplateQuestion,
  TemplatePermission,
  Tag,
  User,
  Topic,
  Form,
  FormAnswer,
} = require('../models');
const { uploadFile } = require('../services/cloudinaryService');
const logger = require('../utils/logger'); // Added logger for consistency with integrationsController.js

// Middleware to parse JSON strings in specific fields
const parseJsonFields = (req, res, next) => {
  const fields = ['questions', 'tags', 'permissions'];
  fields.forEach((field) => {
    if (typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (error) {
        console.log(`❌ ParseJsonFields failed for ${field}: ${error.message}`, {
          timestamp: new Date().toISOString(),
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          errors: [{ msg: `Invalid JSON format for ${field}`, path: field }],
        });
      }
    }
  });
  next();
};

const validateCreateTemplate = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().optional(),
  body('topic_id').isInt().withMessage('Topic ID must be an integer'),
  body('is_public').isBoolean().withMessage('is_public must be boolean'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('Questions must be a non-empty array')
    .custom((questions) =>
      questions.every(
        (q) =>
          q.type &&
          q.title &&
          ['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time'].includes(q.type)
      )
    )
    .withMessage(
      'Each question must have a valid type (string, text, integer, checkbox, select, multiple_choice, dropdown, linear_scale, date, time) and title'
    )
    .custom((questions) =>
      questions.every((q) =>
        ['select', 'multiple_choice', 'dropdown'].includes(q.type) ? Array.isArray(q.options) && q.options.length >= 2 : true
      )
    )
    .withMessage('Select, multiple_choice, or dropdown questions must have at least two options')
    .custom((questions) =>
      questions.every((q) =>
        q.type === 'linear_scale'
          ? q.min != null && q.max != null && Number.isInteger(q.min) && Number.isInteger(q.max) && q.min < q.max
          : true
      )
    )
    .withMessage('Linear scale questions must have valid integer min and max values, with min less than max'),
  body('tags')
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0))
    .withMessage('Tags must be an array of non-empty strings'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
];

const validateUpdateTemplate = [
  param('id').isInt().withMessage('Template ID must be an integer'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().optional(),
  body('topic_id').isInt().withMessage('Topic ID must be an integer'),
  body('is_public').isBoolean().withMessage('is_public must be boolean'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('Questions must be a non-empty array')
    .custom((questions) =>
      questions.every(
        (q) =>
          q.type &&
          q.title &&
          ['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time'].includes(q.type)
      )
    )
    .withMessage(
      'Each question must have a valid type (string, text, integer, checkbox, select, multiple_choice, dropdown, linear_scale, date, time) and title'
    )
    .custom((questions) =>
      questions.every((q) =>
        ['select', 'multiple_choice', 'dropdown'].includes(q.type) ? Array.isArray(q.options) && q.options.length >= 2 : true
      )
    )
    .withMessage('Select, multiple_choice, or dropdown questions must have at least two options')
    .custom((questions) =>
      questions.every((q) =>
        q.type === 'linear_scale'
          ? q.min != null && q.max != null && Number.isInteger(q.min) && Number.isInteger(q.max) && q.min < q.max
          : true
      )
    )
    .withMessage('Linear scale questions must have valid integer min and max values, with min less than max'),
  body('tags')
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0))
    .withMessage('Tags must be an array of non-empty strings'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
];

// Updated validation for getResults to allow 'owned' or numeric ID
const validateGetTemplate = [
  param('id')
    .custom((value) => !isNaN(value) || value === 'owned')
    .withMessage('Invalid template ID: Must be a number or "owned"'),
];

const createTemplate = [
  parseJsonFields,
  ...validateCreateTemplate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ CreateTemplate validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
        body: req.body,
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!req.user || !req.user.id || isNaN(req.user.id) || req.user.id <= 0) {
      console.log(`❌ CreateTemplate failed: Invalid or missing user authentication`, {
        timestamp: new Date().toISOString(),
        user: req.user,
        headers: req.headers.authorization ? 'Bearer token present' : 'No Bearer token',
      });
      return res.status(401).json({ success: false, message: 'User not authenticated or invalid user ID' });
    }

    const transaction = await Template.sequelize.transaction();
    try {
      const { title, description, topic_id, is_public, questions, tags, permissions } = req.body;
      const user_id = parseInt(req.user.id, 10);
      const parsed_topic_id = parseInt(topic_id, 10);
      const parsedIsPublic = is_public === true || is_public === 'true';

      console.log('ℹ️ Normalized inputs:', {
        user_id,
        parsed_topic_id,
        parsedIsPublic,
        raw_topic_id: topic_id,
        raw_is_public: is_public,
        timestamp: new Date().toISOString(),
      });

      // Validate user
      const user = await User.findByPk(user_id, {
        attributes: ['id', 'email', 'name'],
        transaction,
      });
      if (!user) {
        console.log(`❌ CreateTemplate failed: User ID ${user_id} not found in Users table`, {
          timestamp: new Date().toISOString(),
          user_id,
          req_user: req.user,
          headers: req.headers.authorization ? 'Bearer token present' : 'No Bearer token',
          database_query: 'SELECT id, email, name FROM "Users" WHERE id = ' + user_id,
          users_table_count: await User.count({ transaction }),
          existing_user_ids: (await User.findAll({ attributes: ['id'], transaction })).map((u) => u.id),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `User ID ${user_id} does not exist` });
      }

      console.log(`✅ User validated: ID ${user_id}, Email: ${user.email}, Name: ${user.name}`, {
        timestamp: new Date().toISOString(),
      });

      // Validate topic
      if (isNaN(parsed_topic_id) || parsed_topic_id <= 0) {
        console.log(`❌ CreateTemplate failed: Topic ID ${topic_id} is not a valid integer`, {
          timestamp: new Date().toISOString(),
          topic_id,
          raw_topic_id: topic_id,
          topics_table_count: await Topic.count({ transaction }),
          existing_topic_ids: (await Topic.findAll({ attributes: ['id', 'name'], transaction })).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Topic ID must be a valid positive integer' });
      }
      const topic = await Topic.findByPk(parsed_topic_id, {
        attributes: ['id', 'name'],
        transaction,
      });
      if (!topic) {
        console.log(`❌ CreateTemplate failed: Topic ID ${parsed_topic_id} not found in Topics table`, {
          timestamp: new Date().toISOString(),
          topic_id: parsed_topic_id,
          raw_topic_id: topic_id,
          topics_table_count: await Topic.count({ transaction }),
          existing_topic_ids: (await Topic.findAll({ attributes: ['id', 'name'], transaction })).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Topic ID ${parsed_topic_id} does not exist` });
      }

      console.log(`✅ Topic validated: ID ${parsed_topic_id}, Name: ${topic.name}`, {
        timestamp: new Date().toISOString(),
      });

      // Handle image upload
      const image = req.files?.image?.[0];
      let image_url;

      if (image) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(image.mimetype)) {
          console.log(`❌ CreateTemplate failed: Invalid image type for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: image.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid image type. Use JPEG, PNG, or GIF.' });
        }
        if (image.size > 5 * 1024 * 1024) {
          console.log(`❌ CreateTemplate failed: Image size too large for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            size: image.size,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Image size must be less than 5MB.' });
        }

        const uploadResult = await uploadFile(image, user_id);
        if (!uploadResult.success) {
          console.log(`❌ CreateTemplate failed: Image upload failed for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            error: uploadResult.message,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: uploadResult.message });
        }
        image_url = uploadResult.url;
      }

      // Handle question attachments
      const questionAttachments = req.files?.questionAttachments || [];
      const attachmentUrls = [];
      const allowedAttachmentTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'video/mp4',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      for (let i = 0; i < questionAttachments.length; i++) {
        const attachment = questionAttachments[i];
        if (!allowedAttachmentTypes.includes(attachment.mimetype)) {
          console.log(`❌ CreateTemplate failed: Invalid attachment type for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: attachment.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Invalid attachment type. Use JPEG, PNG, PDF, MP4, DOC, or DOCX.',
          });
        }
        if (attachment.size > 10 * 1024 * 1024) {
          console.log(`❌ CreateTemplate failed: Attachment size too large for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            size: attachment.size,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Attachment size must be less than 10MB.' });
        }
        const uploadResult = await uploadFile(attachment, user_id);
        if (!uploadResult.success) {
          console.log(`❌ CreateTemplate failed: Attachment upload failed for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            error: uploadResult.message,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: uploadResult.message });
        }
        attachmentUrls[i] = uploadResult.url;
      }

      // Create template
      console.log(`ℹ️ Attempting Template.create: user_id=${user_id}, topic_id=${parsed_topic_id}`, {
        timestamp: new Date().toISOString(),
        template_data: { user_id, title, description, topic_id: parsed_topic_id, is_public: parsedIsPublic },
      });

      const template = await Template.create(
        {
          user_id,
          title,
          description,
          image_url,
          topic_id: parsed_topic_id,
          is_public: parsedIsPublic,
          search_vector: Sequelize.fn('to_tsvector', 'english', `${title} ${description || ''}`),
        },
        {
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ Template.create SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              user_id,
              topic_id: parsed_topic_id,
              is_public: parsedIsPublic,
              bindings: queryObject.bind,
            });
          },
        }
      );

      // Verify template creation
      if (!template || !template.id) {
        console.log(`❌ CreateTemplate failed: Template creation returned no ID`, {
          timestamp: new Date().toISOString(),
          user_id,
          topic_id: parsed_topic_id,
          template_data: { user_id, title, description, topic_id: parsed_topic_id, is_public: parsedIsPublic },
        });
        await transaction.rollback();
        return res.status(500).json({ success: false, message: 'Failed to create template: No ID returned' });
      }

      console.log(`✅ Template created: ID ${template.id}, Title: ${title}`, {
        timestamp: new Date().toISOString(),
        user_id,
        topic_id: parsed_topic_id,
      });

      // Create questions
      await TemplateQuestion.bulkCreate(
        questions.map((q, index) => ({
          template_id: template.id,
          type: q.type,
          title: q.title,
          description: q.description,
          is_visible_in_results: q.is_visible_in_results ?? true,
          order: index,
          is_required: q.state === 'required',
          options: ['select', 'multiple_choice', 'dropdown'].includes(q.type) ? q.options : null,
          attachment_url: attachmentUrls[index] || null,
          min: q.type === 'linear_scale' ? q.min : null,
          max: q.type === 'linear_scale' ? q.max : null,
          min_label: q.type === 'linear_scale' ? q.minLabel : null,
          max_label: q.type === 'linear_scale' ? q.maxLabel : null,
        })),
        {
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ TemplateQuestion.bulkCreate SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: template.id,
              bindings: queryObject.bind,
            });
          },
        }
      );

      // Resolve and set tags
      console.log(`ℹ️ Resolving tags for template ${template.id}:`, {
        tags,
        timestamp: new Date().toISOString(),
      });

      const tagNames = tags || [];
      if (tagNames.length > 0) {
        const tagsFromDb = await Tag.findAll({
          where: { name: tagNames },
          attributes: ['id', 'name'],
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ Tag.findAll SQL for tags: ${sql}`, {
              timestamp: new Date().toISOString(),
              bindings: queryObject.bind,
            });
          },
        });

        const existingTagNames = tagsFromDb.map((t) => t.name);
        const missingTagNames = tagNames.filter((n) => !existingTagNames.includes(n));
        const tagRecords = [...tagsFromDb];

        for (const name of missingTagNames) {
          const newTag = await Tag.create(
            { name },
            {
              transaction,
              logging: (sql, queryObject) => {
                console.log(`ℹ️ Tag.create SQL for '${name}': ${sql}`, {
                  timestamp: new Date().toISOString(),
                  bindings: queryObject.bind,
                });
              },
            }
          );
          tagRecords.push(newTag);
        }

        console.log(`✅ Resolved ${tagRecords.length} tags for template ${template.id}:`, {
          tag_ids: tagRecords.map((t) => t.id),
          tag_names: tagRecords.map((t) => t.name),
          timestamp: new Date().toISOString(),
        });

        await template.setTags(tagRecords, {
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ template.setTags SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: template.id,
              bindings: queryObject.bind,
            });
          },
        });
      }

      // Set permissions
      if (!parsedIsPublic && permissions.length > 0) {
        const permissionUsers = await User.findAll({
          where: { id: permissions },
          attributes: ['id'],
          transaction,
        });
        if (permissionUsers.length !== permissions.length) {
          console.log(`❌ CreateTemplate failed: Invalid user IDs in permissions for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            invalid_ids: permissions.filter((id) => !permissionUsers.some((u) => u.id === id)),
            permissions,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid user IDs in permissions' });
        }

        await TemplatePermission.bulkCreate(
          permissions.map((user_id) => ({ template_id: template.id, user_id })),
          {
            transaction,
            logging: (sql, queryObject) => {
              console.log(`ℹ️ TemplatePermission.bulkCreate SQL: ${sql}`, {
                timestamp: new Date().toISOString(),
                template_id: template.id,
                bindings: queryObject.bind,
              });
            },
          }
        );
      }

      // Fetch the created template with associations
      const createdTemplate = await Template.findByPk(template.id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'], required: false },
          { model: Tag, as: 'Tags', attributes: ['id', 'name'], through: { attributes: [] }, required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          {
            model: TemplateQuestion,
            as: 'TemplateQuestions',
            attributes: [
              'id',
              'type',
              'title',
              'description',
              'is_visible_in_results',
              'order',
              'is_required',
              'options',
              'attachment_url',
              'min',
              'max',
              'min_label',
              'max_label',
            ],
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
        transaction,
      });

      await transaction.commit();
      console.log(`✅ Template created: ID ${template.id}, Title: ${title}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        topic_id: parsed_topic_id,
        topic_name: topic.name,
        is_public: parsedIsPublic,
        permissions,
        tags,
      });
      return res.status(201).json({ success: true, template: createdTemplate, message: 'Template created successfully' });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error creating template:', {
        user_id: req.user?.id,
        topic_id: req.body.topic_id,
        error: error.message,
        stack: error.stack,
        body: req.body,
        headers: req.headers.authorization ? 'Bearer token present' : 'No Bearer token',
        users_table_count: await User.count().catch(() => 'Count failed'),
        topics_table_count: await Topic.count().catch(() => 'Count failed'),
        existing_user_ids: (await User.findAll({ attributes: ['id'] }).catch(() => [])).map((u) => u.id),
        existing_topic_ids: (await Topic.findAll({ attributes: ['id', 'name'] }).catch(() => [])).map((t) => ({
          id: t.id,
          name: t.name,
        })),
        sql_error: error.sql || 'No SQL captured',
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const updateTemplate = [
  parseJsonFields,
  ...validateUpdateTemplate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ UpdateTemplate validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
        body: req.body,
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transaction = await Template.sequelize.transaction();
    try {
      const { id } = req.params;
      const { title, description, topic_id, is_public, questions, tags, permissions } = req.body;
      const user_id = parseInt(req.user.id, 10);

      const user = await User.findByPk(user_id, { transaction });
      if (!user) {
        console.log(`❌ UpdateTemplate failed: User ID ${user_id} not found`, {
          timestamp: new Date().toISOString(),
          user_id,
          users_table_count: await User.count({ transaction }),
          existing_user_ids: (await User.findAll({ attributes: ['id'], transaction })).map((u) => u.id),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const template = await Template.findByPk(id, { transaction });
      if (!template || (template.user_id !== user_id && !req.user.is_admin)) {
        console.log(`❌ UpdateTemplate failed: Unauthorized for template ${id}, user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
          template_user_id: template?.user_id,
          user_is_admin: req.user.is_admin,
        });
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const topic = await Topic.findByPk(parseInt(topic_id, 10), {
        attributes: ['id', 'name'],
        transaction,
      });
      if (!topic) {
        console.log(`❌ UpdateTemplate failed: Topic ID ${topic_id} not found for user ${user_id}`, {
          timestamp: new Date().toISOString(),
          topic_id,
          topics_table_count: await Topic.count({ transaction }),
          existing_topic_ids: (await Topic.findAll({ attributes: ['id', 'name'], transaction })).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Topic ID ${topic_id} does not exist` });
      }

      const image = req.files?.image?.[0];
      let image_url;

      if (image) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(image.mimetype)) {
          console.log(`❌ UpdateTemplate failed: Invalid image type for template ${id}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: image.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid image type. Use JPEG, PNG, or GIF.' });
        }
        if (image.size > 5 * 1024 * 1024) {
          console.log(`❌ UpdateTemplate failed: Image size too large for template ${id}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            size: image.size,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Image size must be less than 5MB.' });
        }

        const uploadResult = await uploadFile(image, user_id);
        if (!uploadResult.success) {
          console.log(`❌ UpdateTemplate failed: Image upload failed for template ${id}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            error: uploadResult.message,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: uploadResult.message });
        }
        image_url = uploadResult.url;
      }

      const questionAttachments = req.files?.questionAttachments || [];
      const attachmentUrls = [];
      const allowedAttachmentTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'video/mp4',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      for (let i = 0; i < questionAttachments.length; i++) {
        const attachment = questionAttachments[i];
        if (!allowedAttachmentTypes.includes(attachment.mimetype)) {
          console.log(`❌ UpdateTemplate failed: Invalid attachment type for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: attachment.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Invalid attachment type. Use JPEG, PNG, PDF, MP4, DOC, or DOCX.',
          });
        }
        if (attachment.size > 10 * 1024 * 1024) {
          console.log(`❌ UpdateTemplate failed: Attachment size too large for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            size: attachment.size,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Attachment size must be less than 10MB.' });
        }
        const uploadResult = await uploadFile(attachment, user_id);
        if (!uploadResult.success) {
          console.log(`❌ UpdateTemplate failed: Attachment upload failed for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            error: uploadResult.message,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: uploadResult.message });
        }
        attachmentUrls[i] = uploadResult.url;
      }

      await Template.update(
        {
          title,
          description,
          topic_id: parseInt(topic_id, 10),
          is_public,
          image_url: image_url !== undefined ? image_url : template.image_url,
          search_vector: Sequelize.fn('to_tsvector', 'english', `${title} ${description || ''}`),
        },
        { where: { id }, transaction }
      );

      await TemplateQuestion.destroy({ where: { template_id: id }, transaction });
      await TemplateQuestion.bulkCreate(
        questions.map((q, index) => ({
          template_id: id,
          type: q.type,
          title: q.title,
          description: q.description,
          is_visible_in_results: q.is_visible_in_results ?? true,
          order: index,
          is_required: q.state === 'required',
          options: ['select', 'multiple_choice', 'dropdown'].includes(q.type) ? q.options : null,
          attachment_url: attachmentUrls[index] || null,
          min: q.type === 'linear_scale' ? q.min : null,
          max: q.type === 'linear_scale' ? q.max : null,
          min_label: q.type === 'linear_scale' ? q.minLabel : null,
          max_label: q.type === 'linear_scale' ? q.maxLabel : null,
        })),
        {
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ TemplateQuestion.bulkCreate SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: id,
              bindings: queryObject.bind,
            });
          },
        }
      );

      // Resolve tag names to tag IDs
      console.log(`ℹ️ Resolving tags for template ${id}:`, {
        tags,
        timestamp: new Date().toISOString(),
      });

      const tagNames = tags || [];
      if (tagNames.length > 0) {
        const tagsFromDb = await Tag.findAll({
          where: { name: tagNames },
          attributes: ['id', 'name'],
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ Tag.findAll SQL for tags: ${sql}`, {
              timestamp: new Date().toISOString(),
              bindings: queryObject.bind,
            });
          },
        });

        const existingTagNames = tagsFromDb.map((t) => t.name);
        const missingTagNames = tagNames.filter((n) => !existingTagNames.includes(n));
        const tagRecords = [...tagsFromDb];

        for (const name of missingTagNames) {
          const newTag = await Tag.create(
            { name },
            {
              transaction,
              logging: (sql, queryObject) => {
                console.log(`ℹ️ Tag.create SQL for '${name}': ${sql}`, {
                  timestamp: new Date().toISOString(),
                  bindings: queryObject.bind,
                });
              },
            }
          );
          tagRecords.push(newTag);
        }

        console.log(`✅ Resolved ${tagRecords.length} tags for template ${id}:`, {
          tag_ids: tagRecords.map((t) => t.id),
          tag_names: tagRecords.map((t) => t.name),
          timestamp: new Date().toISOString(),
        });

        await template.setTags(tagRecords, {
          transaction,
          logging: (sql, queryObject) => {
            console.log(`ℹ️ template.setTags SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: id,
              bindings: queryObject.bind,
            });
          },
        });
      } else {
        // Clear existing tags if none provided
        await template.setTags([], { transaction });
      }

      await TemplatePermission.destroy({ where: { template_id: id }, transaction });
      if (!is_public && permissions.length > 0) {
        const permissionUsers = await User.findAll({
          where: { id: permissions },
          attributes: ['id'],
          transaction,
        });
        if (permissionUsers.length !== permissions.length) {
          console.log(`❌ UpdateTemplate failed: Invalid user IDs in permissions for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            invalid_ids: permissions.filter((id) => !permissionUsers.some((u) => u.id === id)),
            permissions,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid user IDs in permissions' });
        }

        await TemplatePermission.bulkCreate(
          permissions.map((user_id) => ({ template_id: id, user_id })),
          {
            transaction,
            logging: (sql, queryObject) => {
              console.log(`ℹ️ TemplatePermission.bulkCreate SQL: ${sql}`, {
                timestamp: new Date().toISOString(),
                template_id: id,
                bindings: queryObject.bind,
              });
            },
          }
        );
      }

      const updatedTemplate = await Template.findByPk(id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'], required: false },
          { model: Tag, as: 'Tags', attributes: ['id', 'name'], through: { attributes: [] }, required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          {
            model: TemplateQuestion,
            as: 'TemplateQuestions',
            attributes: [
              'id',
              'type',
              'title',
              'description',
              'is_visible_in_results',
              'order',
              'is_required',
              'options',
              'attachment_url',
              'min',
              'max',
              'min_label',
              'max_label',
            ],
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
        transaction,
      });

      await transaction.commit();
      console.log(`✅ Template updated: ID ${id}, Title: ${title}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        topic_id,
        topic_name: topic.name,
        is_public,
        permissions,
      });
      return res.json({ success: true, template: updatedTemplate, message: 'Template updated successfully' });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error updating template:', {
        template_id: req.params.id,
        user_id: req.user?.id,
        topic_id: req.body.topic_id,
        error: error.message,
        stack: error.stack,
        body: req.body,
        sql_error: error.sql || 'No SQL captured',
        existing_topic_ids: (await Topic.findAll({ attributes: ['id', 'name'] }).catch(() => [])).map((t) => ({
          id: t.id,
          name: t.name,
        })),
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { latest, top, user, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = user === 'true' && userId ? { user_id: userId } : { is_public: true };

    const baseAttributes = {
      include: [
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "Forms" AS f 
            WHERE f.template_id = "Template"."id"
          )`),
          'formCount',
        ],
      ],
    };

    const baseInclude = [
      { model: User, as: 'User', attributes: ['id', 'name', 'email'], required: false },
      { model: Tag, as: 'Tags', attributes: ['id', 'name'], through: { attributes: [] }, required: false },
      { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
      {
        model: TemplateQuestion,
        as: 'TemplateQuestions',
        attributes: [
          'id',
          'type',
          'title',
          'description',
          'is_visible_in_results',
          'order',
          'is_required',
          'options',
          'attachment_url',
          'min',
          'max',
          'min_label',
          'max_label',
        ],
        required: false,
      },
    ];

    let templates;
    const options = {
      where,
      attributes: { include: baseAttributes.include },
      include: baseInclude,
      offset,
      limit: parseInt(limit, 10),
      subQuery: false,
    };

    if (top) {
      options.order = [[Sequelize.literal('"formCount"'), 'DESC']];
    } else if (latest === 'true') {
      options.order = [['created_at', 'DESC']];
      options.limit = 6;
    } else {
      options.order = [['created_at', 'DESC']];
    }

    templates = await Template.findAll(options);

    const total = await Template.count({ where });

    // Log template data to verify Topic.name
    console.log(`✅ Fetched ${templates.length} templates for User ID ${userId || 'unauthenticated'}`, {
      query: req.query,
      timestamp: new Date().toISOString(),
      page,
      limit,
      total,
      templates: templates.map((t) => ({
        id: t.id,
        title: t.title,
        user_id: t.user_id,
        topic_id: t.topic_id,
        topic_name: t.Topic ? t.Topic.name : 'null',
        template_questions_count: t.TemplateQuestions ? t.TemplateQuestions.length : 0,
      })),
    });

    return res.json({ success: true, templates, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (error) {
    console.error('❌ Error fetching templates:', {
      user_id: req.user?.id,
      error: error.message,
      stack: error.stack,
      query: req.query,
      sql_error: error.sql || 'No SQL captured',
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const searchTemplates = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { query, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    if (!query) {
      console.log(`❌ SearchTemplates failed: No query provided for user ${user_id}`, {
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }

    const sanitizedQuery = query
      .split(' ')
      .map((q) => q.trim())
      .filter(Boolean)
      .join(' & ');

    const templates = await Template.findAll({
      where: [
        Sequelize.literal(`search_vector @@ to_tsquery('english', :search_query)`),
        {
          [Op.or]: [
            { is_public: true },
            { user_id },
            { '$TemplatePermissions.user_id$': user_id },
          ],
        },
      ],
      replacements: { search_query: sanitizedQuery },
      include: [
        { model: User, as: 'User', attributes: ['id', 'name'], required: false },
        { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        { model: TemplatePermission, as: 'TemplatePermissions', required: false },
        {
          model: TemplateQuestion,
          as: 'TemplateQuestions',
          attributes: [
            'id',
            'type',
            'title',
            'description',
            'is_visible_in_results',
            'order',
            'is_required',
            'options',
            'attachment_url',
            'min',
            'max',
            'min_label',
            'max_label',
          ],
          required: false,
        },
      ],
      offset,
      limit: parseInt(limit, 10),
    });

    const total = await Template.count({
      where: [
        Sequelize.literal(`search_vector @@ to_tsquery('english', :search_query)`),
        {
          [Op.or]: [
            { is_public: true },
            { user_id },
            { '$TemplatePermissions.user_id$': user_id },
          ],
        },
      ],
      replacements: { search_query: sanitizedQuery },
    });

    console.log(`✅ Searched ${templates.length} templates for User ID ${user_id}, Query: ${query}`, {
      timestamp: new Date().toISOString(),
      page,
      limit,
      total,
      templates: templates.map((t) => ({
        id: t.id,
        title: t.title,
        user_id: t.user_id,
        topic_id: t.topic_id,
        topic_name: t.Topic ? t.Topic.name : 'null',
        template_questions_count: t.TemplateQuestions ? t.TemplateQuestions.length : 0,
      })),
    });

    return res.json({ success: true, templates, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (error) {
    console.error('❌ Error searching templates:', {
      user_id: req.user.id,
      query: req.query.query,
      error: error.message,
      stack: error.stack,
      sql_error: error.sql || 'No SQL captured',
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const deleteTemplate = [
  param('id').isInt().withMessage('Template ID must be an integer'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ DeleteTemplate validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
        params: req.params,
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transaction = await Template.sequelize.transaction();
    try {
      const { id } = req.params;
      const user_id = parseInt(req.user.id, 10);

      const template = await Template.findByPk(id, {
        attributes: ['id', 'user_id', 'title', 'topic_id'],
        include: [{ model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false }],
        transaction,
      });

      if (!template) {
        console.log(`❌ DeleteTemplate failed: Template ${id} not found for user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
          existing_template_ids: (await Template.findAll({ attributes: ['id'], transaction })).map((t) => t.id),
        });
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      if (template.user_id !== user_id && !req.user.is_admin) {
        console.log(`❌ DeleteTemplate failed: Unauthorized for template ${id}, user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
          template_user_id: template.user_id,
          user_is_admin: req.user.is_admin,
        });
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      await Template.destroy({ where: { id }, transaction });
      await transaction.commit();
      console.log(`✅ Template deleted: ID ${id}, Title: ${template.title}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        topic_id: template.topic_id,
        topic_name: template.Topic ? template.Topic.name : 'null',
      });
      return res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error deleting template:', {
        template_id: req.params.id,
        user_id: req.user?.id,
        error: error.message,
        stack: error.stack,
        sql_error: error.sql || 'No SQL captured',
        existing_template_ids: (await Template.findAll({ attributes: ['id'] }).catch(() => [])).map((t) => t.id),
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getTemplate = [
  ...validateGetTemplate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ GetTemplate validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const user_id = parseInt(req.user?.id, 10);

      const template = await Template.findByPk(id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'], required: false },
          { model: Tag, as: 'Tags', attributes: ['id', 'name'], through: { attributes: [] }, required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          {
            model: TemplateQuestion,
            as: 'TemplateQuestions',
            attributes: [
              'id',
              'type',
              'title',
              'description',
              'is_visible_in_results',
              'order',
              'is_required',
              'options',
              'attachment_url',
              'min',
              'max',
              'min_label',
              'max_label',
            ],
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
      });

      if (!template) {
        console.log(`❌ GetTemplate failed: Template ${id} not found for user ${user_id || 'unauthenticated'}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
          existing_template_ids: (await Template.findAll({ attributes: ['id'] }).catch(() => [])).map((t) => t.id),
        });
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      if (
        !template.is_public &&
        (!user_id || (template.user_id !== user_id && !req.user?.is_admin && !template.TemplatePermissions.some((p) => p.user_id === user_id)))
      ) {
        console.log(`❌ GetTemplate failed: Access denied for template ${id}, user ${user_id || 'unauthenticated'}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
          template_user_id: template.user_id,
          user_is_admin: req.user?.is_admin,
          permissions: template.TemplatePermissions.map((p) => p.user_id),
        });
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      console.log(`✅ Fetched template: ID ${id}, User ID ${user_id || 'unauthenticated'}`, {
        timestamp: new Date().toISOString(),
        topic_id: template.topic_id,
        topic_name: template.Topic ? template.Topic.name : 'null',
        template_questions_count: template.TemplateQuestions ? template.TemplateQuestions.length : 0,
      });
      return res.json({
        success: true,
        template: template.toJSON(),
      });
    } catch (error) {
      console.error('❌ Error fetching template:', {
        template_id: req.params.id,
        user_id: req.user?.id,
        error: error.message,
        stack: error.stack,
        sql_error: error.sql || 'No SQL captured',
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getResults = [
  ...validateGetTemplate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error(`GetResults validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
        params: req.params,
        userId: req.user?.id,
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const user_id = parseInt(req.user.id, 10);

      let templates;
      if (id === 'owned') {
        // Fetch all templates owned by the user
        templates = await Template.findAll({
          where: { user_id },
          include: [
            { model: User, as: 'User', attributes: ['id', 'name', 'email'], required: false },
            { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
            {
              model: TemplateQuestion,
              as: 'TemplateQuestions',
              attributes: ['id', 'type', 'title', 'is_visible_in_results'],
              where: { is_visible_in_results: true },
              required: false,
            },
          ],
        });
      } else {
        // Fetch specific template
        const template = await Template.findByPk(id, {
          attributes: ['id', 'user_id', 'is_public', 'title'],
          include: [
            { model: User, as: 'User', attributes: ['id', 'name', 'email'], required: false },
            { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
            {
              model: TemplateQuestion,
              as: 'TemplateQuestions',
              attributes: ['id', 'type', 'title', 'is_visible_in_results'],
              where: { is_visible_in_results: true },
              required: false,
            },
          ],
        });

        if (!template) {
          logger.error(`GetResults failed: Template ${id} not found for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            template_id: id,
            userId: user_id,
            existing_template_ids: (await Template.findAll({ attributes: ['id'] }).catch(() => [])).map((t) => t.id),
          });
          return res.status(404).json({ success: false, message: 'Template not found' });
        }

        if (!template.is_public && template.user_id !== user_id && !req.user.is_admin) {
          logger.error(`GetResults failed: Access denied for template ${id}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            template_id: id,
            template_user_id: template.user_id,
            user_is_admin: req.user.is_admin,
          });
          return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view results' });
        }

        templates = [template];
      }

      if (!templates.length) {
        logger.info(`No templates found for user ${user_id}`, {
          timestamp: new Date().toISOString(),
          userId: user_id,
        });
        return res.status(404).json({ success: false, message: 'No templates found' });
      }

      const results = await Promise.all(
        templates.map(async (template) => {
          const questions = template.TemplateQuestions || [];

          const questionResults = await Promise.all(
            questions.map(async (question) => {
              const answers = await FormAnswer.findAll({
                include: [
                  {
                    model: Form,
                    as: 'Form', // Specify the alias as defined in FormAnswer model
                    where: { template_id: template.id },
                    attributes: [],
                  },
                ],
                where: { question_id: question.id },
                attributes: ['value'],
              });

              let aggregatedResult = { answer_count: answers.length };
              if (question.type === 'integer' || question.type === 'linear_scale') {
                const values = answers.map((a) => parseInt(a.value)).filter((v) => !isNaN(v));
                aggregatedResult.average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null;
                aggregatedResult.min = values.length ? Math.min(...values) : null;
                aggregatedResult.max = values.length ? Math.max(...values) : null;
              } else if (['text', 'string'].includes(question.type)) {
                const valueCounts = answers.reduce((acc, a) => {
                  acc[a.value] = (acc[a.value] || 0) + 1;
                  return acc;
                }, {});
                aggregatedResult.popular_answers = Object.entries(valueCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([value]) => value);
              }

              return {
                text: question.title,
                type: question.type,
                ...aggregatedResult,
              };
            })
          );

          return {
            template_id: template.id,
            author: template.User?.email || 'Unknown',
            title: template.title,
            topic_name: template.Topic?.name || 'Unknown',
            questions: questionResults,
          };
        })
      );

      logger.info(`Fetched ${results.length} template results for User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        template_ids: results.map((r) => r.template_id),
      });
      return res.json({ success: true, results });
    } catch (error) {
      logger.error(`Error fetching results for user ${req.user?.id}`, {
        template_id: req.params.id,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        sql_error: error.sql || 'No SQL captured',
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

module.exports = {
  createTemplate,
  getTemplates,
  updateTemplate,
  searchTemplates,
  deleteTemplate,
  getTemplate,
  getResults,
};
