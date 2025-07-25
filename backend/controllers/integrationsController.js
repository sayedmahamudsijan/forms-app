const axios = require('axios');
const { User } = require('../models');
const logger = require('../utils/logger');

const syncSalesforce = async (req, res) => {
  const { companyName, phone, address } = req.body;
  const user = req.user;

  if (!companyName || !phone || !address) {
    logger.error('Missing required fields for Salesforce sync', { userId: user.id });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const accountResponse = await axios.post(
      'https://orgfarm-e8b8e800e5-dev-ed.develop.my.salesforce.com/services/data/v60.0/sobjects/Account/',
      { Name: companyName },
      {
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const accountId = accountResponse.data.id;
    if (!accountId) {
      logger.error('Failed to create Salesforce Account', { userId: user.id });
      return res.status(500).json({ error: 'Failed to create Salesforce Account' });
    }

    const contactResponse = await axios.post(
      'https://orgfarm-e8b8e800e5-dev-ed.develop.my.salesforce.com/services/data/v60.0/sobjects/Contact/',
      {
        LastName: user.name || 'Unknown',
        Email: user.email,
        Phone: phone,
        MailingStreet: address,
        AccountId: accountId
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Successfully synced with Salesforce', { userId: user.id, salesforceId: contactResponse.data.id, accountId });
    res.status(200).json({ message: 'Successfully synced with Salesforce', salesforceId: contactResponse.data.id, accountId });
  } catch (error) {
    logger.error('Salesforce sync failed', {
      userId: user.id,
      error: error.response?.data || error.message
    });
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Salesforce sync failed'
    });
  }
};

const generateOdooToken = async (req, res) => {
  const user = req.user;

  if (!process.env.ODOO_USERNAME || !process.env.ODOO_PASSWORD) {
    logger.error('Odoo credentials missing in environment variables', { userId: user.id });
    return res.status(500).json({ error: 'Server configuration error: Odoo credentials missing' });
  }

  const payload = {
    jsonrpc: '2.0',
    params: {
      db: process.env.ODOO_DB,
      login: process.env.ODOO_USERNAME,
      password: process.env.ODOO_PASSWORD
    }
  };

  logger.info('Sending Odoo authentication request', { userId: user.id, payload });

  try {
    const response = await axios.post(
      process.env.ODOO_API_URL + '/web/session/authenticate',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    const token = response.data.result?.uid;
    if (!token) {
      logger.error('Failed to generate Odoo token: No uid in response', { userId: user.id, response: response.data });
      return res.status(500).json({ error: 'Failed to generate Odoo token: No uid' });
    }

    await User.update({ odoo_token: token }, { where: { id: user.id } });
    logger.info('Odoo token generated successfully', { userId: user.id, token });
    res.status(200).json({ token });
  } catch (error) {
    logger.error('Odoo token generation failed', {
      userId: user.id,
      error: error.response?.data || error.message
    });
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Odoo token generation failed'
    });
  }
};

module.exports = { syncSalesforce, generateOdooToken };
