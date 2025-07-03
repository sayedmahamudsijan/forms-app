const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const logging = isDevelopment ? console.log : false;

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  logging,
  define: {
    underscored: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const connectWithRetry = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');
      return;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error('❌ Max retries reached. Unable to connect to the database.');
        process.exit(1);
      }
    }
  }
};

// Run migrations instead of sync for schema management
const syncDatabase = async () => {
  try {
    // Note: Migrations should be run using `npx sequelize-cli db:migrate`
    // This function ensures the database is ready, but schema changes are handled via migrations
    await sequelize.authenticate();
    console.log('✅ Database ready for migrations. Run `npx sequelize-cli db:migrate` to apply schema changes.');
  } catch (err) {
    console.error('❌ Failed to prepare database for migrations:', err.message);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  Sequelize,
  connectWithRetry,
  syncDatabase,
};