'use strict';

// Note: This file is JavaScript but compatible with TypeScript projects when used with Sequelize TypeScript definitions
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

const { sequelize, Sequelize } = require('../config/database');

const db = {};

try {
  const modelFiles = fs
    .readdirSync(__dirname)
    .filter(
      file =>
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        !file.endsWith('.test.js'),
    );

  console.log(`✅ Loading ${modelFiles.length} model files from ${__dirname}`, {
    timestamp: new Date().toISOString(),
  });
  modelFiles.forEach(file => {
    try {
      const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
      console.log(`✅ Loaded model: ${model.name} from ${file}`, {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`❌ Error loading model ${file} from ${__dirname}:`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  });

  console.log(`✅ Setting associations for ${Object.keys(db).length} models`, {
    timestamp: new Date().toISOString(),
  });
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      try {
        db[modelName].associate(db);
        console.log(`✅ Associations set for model: ${modelName}`, {
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`❌ Error setting associations for ${modelName}:`, {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
} catch (error) {
  console.error('❌ Error initializing models:', {
    directory: __dirname,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;