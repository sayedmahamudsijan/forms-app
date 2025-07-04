'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Ensure type ENUM includes all required values
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_template_questions_type'
            AND enumlabels @> ARRAY['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time']::varchar[]
          ) THEN
            -- Type is correct, no action needed
            RAISE NOTICE 'ENUM type for template_questions.type is already up to date';
          ELSE
            -- Drop and recreate ENUM with all values
            ALTER TABLE template_questions DROP COLUMN type;
            ALTER TABLE template_questions
            ADD COLUMN type ENUM('string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time') NOT NULL;
          END IF;
        END $$;
      `);
      console.log('✅ Verified/Updated type ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Add min, max, minLabel, maxLabel columns if they don't exist
      await queryInterface.addColumn('template_questions', 'min', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'max', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'minLabel', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'maxLabel', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      console.log('✅ Added/Verified min, max, minLabel, maxLabel columns in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Verify attachment_url column (already added by previous migration)
      await queryInterface.addColumn('template_questions', 'attachment_url', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      console.log('✅ Added/Verified attachment_url column in template_questions', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`⚠️ Failed to update template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert type ENUM to a safe subset (e.g., original values if needed)
      await queryInterface.sequelize.query(`
        ALTER TABLE template_questions DROP COLUMN type;
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE template_questions
        ADD COLUMN type ENUM('string', 'text', 'integer', 'checkbox', 'select') NOT NULL;
      `);
      console.log('✅ Reverted type ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Remove added columns
      await queryInterface.removeColumn('template_questions', 'min', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'max', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'minLabel', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'maxLabel', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'attachment_url', { ifExists: true });
      console.log('✅ Removed min, max, minLabel, maxLabel, attachment_url columns from template_questions', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`⚠️ Failed to revert template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
};
