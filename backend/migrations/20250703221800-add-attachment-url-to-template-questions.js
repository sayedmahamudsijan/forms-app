'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('template_questions', 'attachment_url', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      console.log(`✅ Added attachment_url column to template_questions`, {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`⚠️ Failed to add attachment_url column to template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('template_questions', 'attachment_url', { ifExists: true });
      console.log(`✅ Removed attachment_url column from template_questions`, {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`⚠️ Failed to remove attachment_url column from template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
};
