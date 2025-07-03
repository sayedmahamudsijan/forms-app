const { body, param, validationResult } = require('express-validator');
const { Form, FormAnswer, Template, TemplatePermission, TemplateQuestion, Sequelize } = require('../models');
const nodemailer = require('nodemailer');

const submitForm = [
  body('template_id').isInt().withMessage('Template ID must be an integer'),
  body('answers')
    .isArray({ min: 1 }).withMessage('Answers must be a non-empty array')
    .custom(answers => answers.every(a => a.question_id && a.value !== undefined))
    .withMessage('Each answer must have question_id and value'),
  body('email_copy').optional().isBoolean().withMessage('email_copy must be boolean'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transaction = await Form.sequelize.transaction();
    try {
      const { template_id, answers, email_copy } = req.body;
      const user_id = req.user.id;

      const template = await Template.findByPk(template_id, {
        include: [{ model: TemplateQuestion, as: 'TemplateQuestions', attributes: ['id', 'type', 'options'] }],
        transaction
      });
      if (
        !template ||
        (!template.is_public &&
          !(await TemplatePermission.findOne({ where: { template_id, user_id }, transaction })))
      ) {
        console.log(`❌ SubmitForm failed: No access to template ${template_id} for user ${user_id}`);
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'No access to this template' });
      }

      // Validate answers against question types
      for (const answer of answers) {
        const question = template.TemplateQuestions.find(q => q.id === answer.question_id);
        if (!question) {
          console.log(`❌ SubmitForm failed: Invalid question ID ${answer.question_id} for template ${template_id}`);
          await transaction.rollback();
          return res.status(400).json({ success: false, message: `Invalid question ID: ${answer.question_id}` });
        }
        if (question.type === 'select' && !question.options.includes(answer.value)) {
          console.log(`❌ SubmitForm failed: Invalid value for select question ${answer.question_id}`);
          await transaction.rollback();
          return res.status(400).json({ success: false, message: `Invalid value for question ${answer.question_id}` });
        }
        if (question.type === 'integer' && isNaN(parseInt(answer.value))) {
          console.log(`❌ SubmitForm failed: Invalid integer value for question ${answer.question_id}`);
          await transaction.rollback();
          return res.status(400).json({ success: false, message: `Invalid integer value for question ${answer.question_id}` });
        }
      }

      const form = await Form.create({
        template_id,
        user_id,
      }, { transaction });

      await FormAnswer.bulkCreate(
        answers.map((a) => ({
          form_id: form.id,
          question_id: a.question_id,
          value: a.value,
        })),
        { transaction }
      );

      // Email copy feature
      if (email_copy) {
        const user = await User.findByPk(user_id, { attributes: ['email', 'name'], transaction });
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const answersText = answers.map(a => {
          const question = template.TemplateQuestions.find(q => q.id === a.question_id);
          return `${question.title}: ${a.value}`;
        }).join('\n');

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Form Submission Copy: ${template.title}`,
          text: `Dear ${user.name},\n\nYou submitted the following form:\n\n${answersText}\n\nThank you!`,
        });
        console.log(`✅ Email copy sent to ${user.email} for Form ID ${form.id}`);
      }

      await transaction.commit();
      console.log(`✅ Form submitted: Template ID ${template_id}, User ID ${user_id}, Form ID ${form.id}`);
      return res.status(201).json({ success: true, form, message: 'Form submitted successfully' });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error submitting form:', { template_id: req.body.template_id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getFormResults = [
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
      if (!template || (template.user_id !== user_id && !req.user.is_admin)) {
        console.log(`❌ GetFormResults failed: Unauthorized for template ${template_id}, user ${user_id}`);
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const forms = await Form.findAll({
        where: { template_id },
        include: [{
          model: FormAnswer,
          as: 'FormAnswers',
          include: [{
            model: TemplateQuestion,
            as: 'TemplateQuestion',
            attributes: ['id', 'title', 'type', 'is_visible_in_results'],
            where: { is_visible_in_results: true },
          }],
        }],
      });

      const aggregates = await FormAnswer.findAll({
        attributes: [
          'question_id',
          [Sequelize.fn('AVG', Sequelize.col('value')), 'avg_value'],
        ],
        include: [{
          model: Form,
          as: 'Form',
          where: { template_id },
          attributes: [],
        }, {
          model: TemplateQuestion,
          as: 'TemplateQuestion',
          where: { is_visible_in_results: true },
          attributes: [],
        }],
        group: ['question_id'],
      });

      console.log(`✅ Fetched results for Template ID ${template_id}, User ID ${user_id}`);
      return res.json({ success: true, forms, aggregates });
    } catch (error) {
      console.error('❌ Error fetching results:', { template_id: req.params.template_id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

const getUserForms = async (req, res) => {
  try {
    const user_id = req.user.id;
    if (!user_id) {
      console.error('❌ Invalid user ID in getUserForms:', req.user);
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid user ID' });
    }

    const forms = await Form.findAll({
      where: { user_id },
      include: [
        {
          model: Template,
          as: 'Template',
          attributes: ['id', 'title', 'is_public'],
        },
        {
          model: FormAnswer,
          as: 'FormAnswers',
          attributes: ['question_id', 'value'],
          include: [{
            model: TemplateQuestion,
            as: 'TemplateQuestion',
            attributes: ['id', 'title', 'type', 'is_visible_in_results'],
            where: { is_visible_in_results: true },
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    if (!forms || forms.length === 0) {
      console.log(`✅ No forms found for User ID ${user_id}`);
      return res.status(404).json({ success: false, message: 'No forms found for this user', forms: [] });
    }

    console.log(`✅ Fetched ${forms.length} forms for User ID ${user_id}`);
    return res.json({ success: true, forms });
  } catch (error) {
    console.error('❌ Error fetching user forms:', { user_id: req.user?.id, error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { submitForm, getFormResults, getUserForms };