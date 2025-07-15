const axios = require('axios');
const { User } = require('../models');
const crypto = require('crypto');

// Salesforce Sync
exports.syncSalesforce = async (req, res) => {
  try {
    const { companyName, phone, address } = req.body;
    const user = req.user; // From authMiddleware

    if (!companyName || !phone || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const salesforceUrl = process.env.SALESFORCE_API_URL;
    const salesforceToken = process.env.SALESFORCE_ACCESS_TOKEN;

    if (!salesforceUrl || !salesforceToken) {
      return res.status(500).json({ error: 'Salesforce configuration missing' });
    }

    // Create or update a Salesforce Contact
    await axios.post(
      `${salesforceUrl}/sobjects/Contact`,
      {
        FirstName: user.name.split(' ')[0] || user.name,
        LastName: user.name.split(' ')[1] || 'Unknown',
        Email: user.email,
        Phone: phone,
        MailingStreet: address,
        Account: { Name: companyName },
      },
      {
        headers: {
          Authorization: `Bearer ${salesforceToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(200).json({ message: 'Successfully synced with Salesforce' });
  } catch (error) {
    console.error('❌ Salesforce sync error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to sync with Salesforce',
    });
  }
};

// Odoo Token Generation
exports.generateOdooToken = async (req, res) => {
  try {
    const user = req.user; // From authMiddleware
    const odooUrl = process.env.ODOO_API_URL;
    const odooDb = process.env.ODOO_DB;
    const odooUsername = process.env.ODOO_USERNAME;
    const odooPassword = process.env.ODOO_PASSWORD;

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      return res.status(500).json({ error: 'Odoo configuration missing' });
    }

    // Authenticate with Odoo
    const authResponse = await axios.post(`${odooUrl}/web/session/authenticate`, {
      jsonrpc: '2.0',
      params: { db: odooDb, login: odooUsername, password: odooPassword },
    });

    if (!authResponse.data.result?.uid) {
      return res.status(401).json({ error: 'Odoo authentication failed' });
    }

    // Generate a random API token
    const token = crypto.randomBytes(32).toString('hex');

    // Update user with Odoo token
    await User.update({ odoo_token: token }, { where: { id: user.id } });

    return res.status(200).json({ token });
  } catch (error) {
    console.error('❌ Odoo token generation error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(error.response?.status || 500).json({
      error: 'Failed to generate Odoo token',
    });
  }
};
