const { body, param, validationResult } = require('express-validator');
const { User } = require('../models');

const validateUpdateUser = [
  param('id').isInt().withMessage('User ID must be an integer'),
  body('is_admin').isBoolean().withMessage('is_admin must be boolean'),
  body('is_blocked').isBoolean().withMessage('is_blocked must be boolean'),
  body('version').isInt().withMessage('Version must be an integer'),
];

const getUsers = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      console.log('❌ GetUsers failed: No authenticated user');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const users = await User.findAll({ attributes: ['id', 'name', 'email'] });
    console.log(`✅ Fetched ${users.length} users for User ID ${user_id}`);
    return res.json({ success: true, users });
  } catch (error) {
    console.error('❌ Error fetching users:', { user_id: req.user?.id, error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const user_id = req.user.id;
    if (!req.user.is_admin) {
      console.log(`❌ GetAdminUsers failed: User ${user_id} is not an admin`);
      return res.status(403).json({ success: false, message: 'Only admins can access this endpoint' });
    }

    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    console.log(`✅ Fetched ${users.length} admin users for User ID ${user_id}`);
    return res.json({ success: true, users });
  } catch (error) {
    console.error('❌ Error fetching admin users:', { user_id: req.user?.id, error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const updateUser = [
  ...validateUpdateUser,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ UpdateUser validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { is_admin, is_blocked, version } = req.body;
      const user_id = req.user.id;

      if (!req.user.is_admin) {
        console.log(`❌ UpdateUser failed: User ${user_id} is not an admin`);
        return res.status(403).json({ success: false, message: 'Only admins can update users' });
      }

      const [updatedCount] = await User.update(
        { is_admin, is_blocked, version: version + 1 },
        { where: { id, version } },
      );

      if (updatedCount === 0) {
        console.log(`❌ UpdateUser failed: Version conflict for user ${id}, requester ${user_id}`);
        return res.status(409).json({ success: false, message: 'User modified by another user. Please reload.' });
      }

      console.log(`✅ User updated: ID ${id}, Requester ID ${user_id}`);
      return res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
      console.error('❌ Error updating user:', { target_user_id: req.params.id, user_id: req.user.id, error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  },
];

module.exports = { getUsers, getAdminUsers, updateUser };