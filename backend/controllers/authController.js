const { validationResult, body } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const validateRegister = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const validateLogin = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validateUpdate = [
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('language').optional().isIn(['en', 'es']).withMessage('Invalid language'),
  body('theme').optional().isIn(['light', 'dark']).withMessage('Invalid theme'),
];

const register = [
  ...validateRegister,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ Register validation failed: ${JSON.stringify(errors.array(), null, 2)}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, name, password } = req.body;

    try {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        console.log(`❌ Register failed: Email already exists: ${email}`);
        return res.status(400).json({ success: false, message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        email,
        name,
        password: hashedPassword,
        is_admin: false,
        is_blocked: false,
        language: 'en',
        theme: 'light',
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      console.log(`✅ Registered user: ${email}, ID: ${user.id}`);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: { id: user.id, email, name, is_admin: user.is_admin, language: user.language, theme: user.theme },
      });
    } catch (err) {
      console.error('❌ Register error:', { email, error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  },
];

const login = [
  ...validateLogin,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ Login validation failed: ${JSON.stringify(errors.array(), null, 2)}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        console.log(`❌ Login attempt failed: User not found for email ${email}`);
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }

      if (user.is_blocked) {
        console.log(`❌ Login attempt failed: User ${email} is blocked`);
        return res.status(403).json({ success: false, message: 'User is blocked' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`❌ Login attempt failed: Invalid password for email ${email}`);
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      console.log(`✅ Login successful: ${email}, ID: ${user.id}`);
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { id: user.id, email, name: user.name, is_admin: user.is_admin, language: user.language, theme: user.theme },
      });
    } catch (err) {
      console.error('❌ Login error:', { email, error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  },
];

const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'is_admin', 'language', 'theme'],
    });
    if (!user) {
      console.log(`❌ GetMe failed: User ID ${req.user.id} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`✅ GetMe successful: User ID ${req.user.id}, Email: ${user.email}`);
    return res.json({ success: true, user });
  } catch (err) {
    console.error('❌ GetMe error:', { userId: req.user.id, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const updateMe = [
  ...validateUpdate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ UpdateMe validation failed: ${JSON.stringify(errors.array(), null, 2)}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, name, language, theme } = req.body;
      const user = await User.findByPk(req.user.id);
      if (!user) {
        console.log(`❌ UpdateMe failed: User ID ${req.user.id} not found`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          console.log(`❌ UpdateMe failed: Email ${email} already in use for User ID ${req.user.id}`);
          return res.status(400).json({ success: false, message: 'Email already in use' });
        }
      }

      await user.update({ email, name, language, theme });
      console.log(`✅ UpdateMe successful: User ID ${req.user.id}, Email: ${user.email}`);
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin, language: user.language, theme: user.theme },
      });
    } catch (err) {
      console.error('❌ UpdateMe error:', { userId: req.user.id, error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  },
];

module.exports = { register, login, getMe, updateMe };