const { Topic } = require('../models');
const { body, validationResult } = require('express-validator');

const getTopics = async (req, res) => {
  try {
    const topics = await Topic.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    console.log(`✅ Fetched ${topics.length} topics for User ID ${req.user?.id || 'unknown'}`);
    return res.json({ success: true, topics });
  } catch (error) {
    console.error('❌ Error fetching topics:', { user_id: req.user?.id, error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const createTopic = [
  body('name').trim().notEmpty().withMessage('Topic name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ CreateTopic validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const user_id = req.user.id;
      if (!req.user.is_admin) {
        console.log(`❌ CreateTopic failed: User ${user_id} is not an admin`);
        return res.status(403).json({ success: false, message: 'Only admins can create topics' });
      }

      const { name } = req.body;
      const existingTopic = await Topic.findOne({ where: { name } });
      if (existingTopic) {
        console.log(`❌ CreateTopic failed: Topic '${name}' already exists for user ${user_id}`);
        return res.status(400).json({ success: false, message: 'Topic name already exists' });
      }

      const topic = await Topic.create({ name });
      console.log(`✅ Topic created: ID ${topic.id}, Name: ${name}, User ID ${user_id}`);
      return res.status(201).json({ success: true, topic, message: 'Topic created successfully' });
    } catch (error) {
      console.error('❌ Error creating topic:', { user_id: req.user.id, name: req.body.name, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

module.exports = { getTopics, createTopic };