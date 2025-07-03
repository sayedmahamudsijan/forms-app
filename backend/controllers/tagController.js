const { Tag } = require('../models');

const getAllTags = async (req, res) => {
  try {
    const tags = await Tag.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    console.log(`✅ Fetched ${tags.length} tags for User ID ${req.user?.id || 'unknown'}`);
    return res.json({ success: true, tags });
  } catch (error) {
    console.error('❌ Error fetching tags:', { user_id: req.user?.id, error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to load tags', error: error.message });
  }
};

module.exports = { getAllTags };