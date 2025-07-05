const { body, param, validationResult } = require('express-validator');
const { Sequelize, Op } = require('sequelize');
const {
  Template,
  TemplateQuestion,
  TemplatePermission,
  TemplateTag,
  Tag,
  User,
  Topic,
  Form,
  FormAnswer,
} = require('../models');
const { uploadFile } = require('../services/cloudinaryService');

// Middleware to parse JSON strings in specific fields
const parseJsonFields = (req, res, next) => {
  const fields = ['questions', 'tags', 'permissions'];
  fields.forEach(field => {
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
    .custom(questions =>
      questions.every(q => q.type && q.title && ['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time'].includes(q.type))
    )
    .withMessage('Each question must have a valid type (string, text, integer, checkbox, select, multiple_choice, dropdown, linear_scale, date, time) and title')
    .custom(questions =>
      questions.every(q =>
        ['select', 'multiple_choice', 'dropdown'].includes(q.type)
          ? Array.isArray(q.options) && q.options.length >= 2
          : true
      )
    )
    .withMessage('Select, multiple_choice, or dropdown questions must have at least two options')
    .custom(questions =>
      questions.every(q =>
        q.type === 'linear_scale'
          ? q.min != null && q.max != null && Number.isInteger(q.min) && Number.isInteger(q.max) && q.min < q.max
          : true
      )
    )
    .withMessage('Linear scale questions must have valid integer min and max values, with min less than max'),
  body('tags')
    .isArray().withMessage('Tags must be an array')
    .custom(tags => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0))
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
    .custom(questions =>
      questions.every(q => q.type && q.title && ['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time'].includes(q.type))
    )
    .withMessage('Each question must have a valid type (string, text, integer, checkbox, select, multiple_choice, dropdown, linear_scale, date, time) and title')
    .custom(questions =>
      questions.every(q =>
        ['select', 'multiple_choice', 'dropdown'].includes(q.type)
          ? Array.isArray(q.options) && q.options.length >= 2
          : true
      )
    )
    .withMessage('Select, multiple_choice, or dropdown questions must have at least two options')
    .custom(questions =>
      questions.every(q =>
        q.type === 'linear_scale'
          ? q.min != null && q.max != null && Number.isInteger(q.min) && Number.isInteger(q.max) && q.min < q.max
          : true
      )
    )
    .withMessage('Linear scale questions must have valid integer min and max values, with min less than max'),
  body('tags')
    .isArray().withMessage('Tags must be an array')
    .custom(tags => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0))
    .withMessage('Tags must be an array of non-empty strings'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
];

const validateGetTemplate = [
  param('id').isInt().withMessage('Invalid template ID'),
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
          existing_user_ids: (await User.findAll({ attributes: ['id'], transaction })).map(u => u.id),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `User ID ${user_id} does not exist` });
      }

      console.log(`✅ User validated: ID ${user_id}, Email: ${user.email}, Name: ${user.name}`, {
        timestamp: new Date().toISOString(),
      });

      if (isNaN(parsed_topic_id) || parsed_topic_id <= 0) {
        console.log(`❌ CreateTemplate failed: Topic ID ${topic_id} is not a valid integer`, {
          timestamp: new Date().toISOString(),
          topic_id,
          raw_topic_id: topic_id,
          topics_table_count: await Topic.count({ transaction }),
          existing_topic_ids: (await Topic.findAll({ attributes: ['id'], transaction })).map(t => t.id),
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
          existing_topic_ids: (await Topic.findAll({ attributes: ['id'], transaction })).map(t => t.id),
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Topic ID ${parsed_topic_id} does not exist` });
      }

      console.log(`✅ Topic validated: ID ${parsed_topic_id}, Name: ${topic.name}`, {
        timestamp: new Date().toISOString(),
      });

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

      const questionAttachments = req.files?.questionAttachments || [];
      const attachmentUrls = [];
      const allowedAttachmentTypes = [
        'image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      for (let i = 0; i < questionAttachments.length; i++) {
        const attachment = questionAttachments[i];
        if (!allowedAttachmentTypes.includes(attachment.mimetype)) {
          console.log(`❌ CreateTemplate failed: Invalid attachment type for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: attachment.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid attachment type. Use JPEG, PNG, PDF, MP4, DOC, or DOCX.' });
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

      console.log(`ℹ️ Attempting Template.create: user_id=${user_id}, topic_id=${parsed_topic_id}`, {
        timestamp: new Date().toISOString(),
        template_data: { user_id, title, description, topic_id: parsed_topic_id, is_public: parsedIsPublic },
      });

      const template = await Template.create({
        user_id,
        title,
        description,
        image_url,
        topic_id: parsed_topic_id,
        is_public: parsedIsPublic,
        search_vector: Sequelize.fn('to_tsvector', 'english', `${title} ${description || ''}`),
      }, {
        transaction,
        logging: (sql) => {
          console.log(`ℹ️ Template.create SQL: ${sql}`, {
            timestamp: new Date().toISOString(),
            user_id,
            topic_id: parsed_topic_id,
            is_public: parsedIsPublic,
          });
        }
      });

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
        { transaction }
      );

      // Resolve tag names to tag IDs
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
          logging: (sql) => {
            console.log(`ℹ️ Tag.findAll SQL for tags: ${sql}`, {
              timestamp: new Date().toISOString(),
            });
          }
        });

        const existingTagNames = tagsFromDb.map(t => t.name);
        const missingTagNames = tagNames.filter(n => !existingTagNames.includes(n));
        const tagRecords = [...tagsFromDb];

        // Create missing tags
        for (const name of missingTagNames) {
          const newTag = await Tag.create({ name }, {
            transaction,
            logging: (sql) => {
              console.log(`ℹ️ Tag.create SQL for '${name}': ${sql}`, {
                timestamp: new Date().toISOString(),
              });
            }
          });
          tagRecords.push(newTag);
        }

        console.log(`✅ Resolved ${tagRecords.length} tags for template ${template.id}:`, {
          tag_ids: tagRecords.map(t => t.id),
          tag_names: tagRecords.map(t => t.name),
          timestamp: new Date().toISOString(),
        });

        // Associate tags using setTags
        await template.setTags(tagRecords, {
          transaction,
          logging: (sql) => {
            console.log(`ℹ️ template.setTags SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: template.id,
            });
          }
        });
      }

      if (!parsedIsPublic && permissions.length > 0) {
        const permissionUsers = await User.findAll({
          where: { id: permissions },
          attributes: ['id'],
          transaction,
        });
        if (permissionUsers.length !== permissions.length) {
          console.log(`❌ CreateTemplate failed: Invalid user IDs in permissions for user ${user_id}`, {
            timestamp: new Date().toISOString(),
            invalid_ids: permissions.filter(id => !permissionUsers.some(u => u.id === id)),
            permissions,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid user IDs in permissions' });
        }

        await TemplatePermission.bulkCreate(
          permissions.map(user_id => ({ template_id: template.id, user_id })),
          { transaction }
        );
      }

      const createdTemplate = await Template.findByPk(template.id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'], required: false },
          { model: TemplateTag, as: 'TemplateTags', include: [{ model: Tag, as: 'Tag', attributes: ['id', 'name'] }], required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          { 
            model: TemplateQuestion, 
            as: 'TemplateQuestions', 
            attributes: ['id', 'type', 'title', 'description', 'is_visible_in_results', 'order', 'is_required', 'options', 'attachment_url', 'min', 'max', 'min_label', 'max_label'] 
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
        transaction
      });

      await transaction.commit();
      console.log(`✅ Template created: ID ${template.id}, Title: ${title}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        topic_id: parsed_topic_id,
        is_public: parsedIsPublic,
        permissions,
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
        existing_user_ids: (await User.findAll({ attributes: ['id'] }).catch(() => [])).map(u => u.id),
        existing_topic_ids: (await Topic.findAll({ attributes: ['id'] }).catch(() => [])).map(t => t.id),
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
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const template = await Template.findByPk(id, { transaction });
      if (!template || (template.user_id !== user_id && !req.user.is_admin)) {
        console.log(`❌ UpdateTemplate failed: Unauthorized for template ${id}, user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const topic = await Topic.findByPk(parseInt(topic_id, 10), { transaction });
      if (!topic) {
        console.log(`❌ UpdateTemplate failed: Topic ID ${topic_id} not found for user ${user_id}`, {
          timestamp: new Date().toISOString(),
          topic_id,
        });
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Invalid topic ID' });
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
        'image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      for (let i = 0; i < questionAttachments.length; i++) {
        const attachment = questionAttachments[i];
        if (!allowedAttachmentTypes.includes(attachment.mimetype)) {
          console.log(`❌ UpdateTemplate failed: Invalid attachment type for question ${i}, user ${user_id}`, {
            timestamp: new Date().toISOString(),
            mimetype: attachment.mimetype,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid attachment type. Use JPEG, PNG, PDF, MP4, DOC, or DOCX.' });
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
        { transaction }
      );

      // Resolve tag names to tag IDs
      console.log(`ℹ️ Resolving tags for template ${id}:`, {
        tags,
        timestamp: new Date().toISOString(),
      });

      await TemplateTag.destroy({ where: { template_id: id }, transaction });
      const tagNames = tags || [];
      if (tagNames.length > 0) {
        const tagsFromDb = await Tag.findAll({
          where: { name: tagNames },
          attributes: ['id', 'name'],
          transaction,
          logging: (sql) => {
            console.log(`ℹ️ Tag.findAll SQL for tags: ${sql}`, {
              timestamp: new Date().toISOString(),
            });
          }
        });

        const existingTagNames = tagsFromDb.map(t => t.name);
        const missingTagNames = tagNames.filter(n => !existingTagNames.includes(n));
        const tagRecords = [...tagsFromDb];

        for (const name of missingTagNames) {
          const newTag = await Tag.create({ name }, {
            transaction,
            logging: (sql) => {
              console.log(`ℹ️ Tag.create SQL for '${name}': ${sql}`, {
                timestamp: new Date().toISOString(),
              });
            }
          });
          tagRecords.push(newTag);
        }

        console.log(`✅ Resolved ${tagRecords.length} tags for template ${id}:`, {
          tag_ids: tagRecords.map(t => t.id),
          tag_names: tagRecords.map(t => t.name),
          timestamp: new Date().toISOString(),
        });

        await template.setTags(tagRecords, {
          transaction,
          logging: (sql) => {
            console.log(`ℹ️ template.setTags SQL: ${sql}`, {
              timestamp: new Date().toISOString(),
              template_id: id,
            });
          }
        });
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
            invalid_ids: permissions.filter(id => !permissionUsers.some(u => u.id === id)),
            permissions,
          });
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid user IDs in permissions' });
        }

        await TemplatePermission.bulkCreate(
          permissions.map(user_id => ({ template_id: id, user_id })),
          { transaction }
        );
      }

      const updatedTemplate = await Template.findByPk(id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'], required: false },
          { model: TemplateTag, as: 'TemplateTags', include: [{ model: Tag, as: 'Tag', attributes: ['id', 'name'] }], required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          { 
            model: TemplateQuestion, 
            as: 'TemplateQuestions', 
            attributes: ['id', 'type', 'title', 'description', 'is_visible_in_results', 'order', 'is_required', 'options', 'attachment_url', 'min', 'max', 'min_label', 'max_label'] 
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
        transaction
      });

      await transaction.commit();
      console.log(`✅ Template updated: ID ${id}, Title: ${title}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
        topic_id,
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
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { latest, top, user } = req.query;

    const where = user === 'true' && userId
      ? { user_id: userId }
      : { is_public: true };

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
      {
        model: TemplateTag,
        as: 'TemplateTags',
        include: [{ model: Tag, as: 'Tag', attributes: ['id', 'name'] }],
        required: false
      },
      { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false }
    ];

    let templates;
    if (top) {
      templates = await Template.findAll({
        where,
        attributes: { include: baseAttributes.include },
        include: baseInclude,
        order: [[Sequelize.literal('"formCount"'), 'DESC']],
        limit: parseInt(top, 10) || 5,
        subQuery: false,
      });
    } else if (latest === 'true') {
      templates = await Template.findAll({
        where,
        attributes: { include: baseAttributes.include },
        include: baseInclude,
        order: [['created_at', 'DESC']],
        limit: 6,
      });
    } else {
      templates = await Template.findAll({
        where,
        attributes: { include: baseAttributes.include },
        include: baseInclude,
        order: [['created_at', 'DESC']],
      });
    }

    console.log(`✅ Fetched ${templates.length} templates for User ID ${userId || 'unauthenticated'}`, {
      query: req.query,
      timestamp: new Date().toISOString(),
    });
    return res.json({ success: true, templates });
  } catch (error) {
    console.error('❌ Error fetching templates:', {
      user_id: req.user?.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const searchTemplates = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { query } = req.query;
    if (!query) {
      console.log(`❌ SearchTemplates failed: No query provided for user ${user_id}`, {
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }

    const sanitizedQuery = query
      .split(' ')
      .map(q => q.trim())
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
      ],
    });

    console.log(`✅ Searched ${templates.length} templates for User ID ${user_id}, Query: ${query}`, {
      timestamp: new Date().toISOString(),
    });
    return res.json({ success: true, templates });
  } catch (error) {
    console.error('❌ Error searching templates:', {
      user_id: req.user.id,
      query: req.query.query,
      error: error.message,
      stack: error.stack,
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
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const user_id = parseInt(req.user.id, 10);

      const template = await Template.findByPk(id);
      if (!template || (template.user_id !== user_id && !req.user.is_admin)) {
        console.log(`❌ DeleteTemplate failed: Unauthorized for template ${id}, user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      await Template.destroy({ where: { id } });
      console.log(`✅ Template deleted: ID ${id}, User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      console.error('❌ Error deleting template:', {
        template_id: req.params.id,
        user_id: req.user?.id,
        error: error.message,
        stack: error.stack,
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
          { model: TemplateTag, as: 'TemplateTags', include: [{ model: Tag, as: 'Tag', attributes: ['id', 'name'] }], required: false },
          { model: TemplatePermission, as: 'TemplatePermissions', required: false },
          { 
            model: TemplateQuestion, 
            as: 'TemplateQuestions', 
            attributes: ['id', 'type', 'title', 'description', 'is_visible_in_results', 'order', 'is_required', 'options', 'attachment_url', 'min', 'max', 'min_label', 'max_label'] 
          },
          { model: Topic, as: 'Topic', attributes: ['id', 'name'], required: false },
        ],
      });

      if (!template) {
        console.log(`❌ GetTemplate failed: Template ${id} not found for user ${user_id || 'unauthenticated'}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      if (
        !template.is_public &&
        (!user_id || (template.user_id !== user_id && !req.user?.is_admin && !template.TemplatePermissions.some(p => p.user_id === user_id)))
      ) {
        console.log(`❌ GetTemplate failed: Access denied for template ${id}, user ${user_id || 'unauthenticated'}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      console.log(`✅ Fetched template: ID ${id}, User ID ${user_id || 'unauthenticated'}`, {
        timestamp: new Date().toISOString(),
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
      console.log(`❌ GetResults validation failed: ${JSON.stringify(errors.array())}`, {
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const user_id = parseInt(req.user.id, 10);

      const template = await Template.findByPk(id, {
        attributes: ['id', 'user_id', 'is_public'],
      });

      if (!template) {
        console.log(`❌ GetResults failed: Template ${id} not found for user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      if (!template.is_public && template.user_id !== user_id && !req.user.is_admin) {
        console.log(`❌ GetResults failed: Access denied for template ${id}, user ${user_id}`, {
          timestamp: new Date().toISOString(),
          template_id: id,
        });
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view results' });
      }

      const forms = await Form.findAll({
        where: { template_id: id },
        attributes: ['id', 'user_id', 'created_at'],
        include: [
          {
            model: FormAnswer,
            as: 'FormAnswers',
            include: [
              { 
                model: TemplateQuestion, 
                as: 'TemplateQuestion', 
                attributes: ['id', 'title', 'is_visible_in_results', 'attachment_url', 'type', 'options', 'min', 'max', 'min_label', 'max_label'], 
                where: { is_visible_in_results: true },
                required: false 
              }
            ],
            attributes: ['id', 'value'],
          },
          { model: User, as: 'User', attributes: ['id', 'name', 'email'], required: false },
        ],
        order: [['created_at', 'DESC']],
      });

      console.log(`✅ Fetched ${forms.length} results for template ${id} by User ID ${user_id}`, {
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, forms });
    } catch (error) {
      console.error('❌ Error fetching results:', {
        template_id: req.params.id,
        user_id: req.user?.id,
        error: error.message,
        stack: error.stack,
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
