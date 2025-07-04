'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Remove redundant foreign key constraint
      await queryInterface.removeConstraint('template_questions', 'template_questions_template_id_fkey1', { ifExists: true });
      console.log('✅ Removed redundant foreign key constraint template_questions_template_id_fkey1', {
        timestamp: new Date().toISOString(),
      });

      // Ensure attachment_url column exists
      await queryInterface.addColumn('template_questions', 'attachment_url', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      console.log('✅ Added/Verified attachment_url column in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Ensure min, max, min_label, max_label columns exist
      await queryInterface.addColumn('template_questions', 'min', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'max', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'min_label', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      await queryInterface.addColumn('template_questions', 'max_label', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { ifNotExists: true });
      console.log('✅ Added/Verified min, max, min_label, max_label columns in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Verify type ENUM
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_template_questions_type'
            AND enumlabels @> ARRAY['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time']::varchar[]
          ) THEN
            ALTER TABLE template_questions DROP COLUMN type;
            ALTER TABLE template_questions
            ADD COLUMN type ENUM('string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time') NOT NULL;
          END IF;
        END $$;
      `);
      console.log('✅ Verified/Updated type ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Verify state ENUM (optional, as is_required is used, but kept for compatibility)
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'enum_template_questions_state'
            AND enumlabels @> ARRAY['not_present', 'optional', 'required']::varchar[]
          ) THEN
            ALTER TABLE template_questions DROP COLUMN state;
            ALTER TABLE template_questions
            ADD COLUMN state ENUM('not_present', 'optional', 'required') NOT NULL DEFAULT 'optional';
          END IF;
        END $$;
      `);
      console.log('✅ Verified/Updated state ENUM in template_questions', {
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
      // Revert redundant foreign key constraint (no-op if already removed)
      console.log('✅ No revert needed for template_questions_template_id_fkey1 (already removed)', {
        timestamp: new Date().toISOString(),
      });

      // Remove added columns
      await queryInterface.removeColumn('template_questions', 'attachment_url', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'min', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'max', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'min_label', { ifExists: true });
      await queryInterface.removeColumn('template_questions', 'max_label', { ifExists: true });
      console.log('✅ Removed attachment_url, min, max, min_label, max_label columns from template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Revert type ENUM to a minimal set
      await queryInterface.sequelize.query(`
        ALTER TABLE template_questions DROP COLUMN type;
        ALTER TABLE template_questions
        ADD COLUMN type ENUM('string', 'text', 'integer', 'checkbox', 'select') NOT NULL;
      `);
      console.log('✅ Reverted type ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Revert state ENUM
      await queryInterface.sequelize.query(`
        ALTER TABLE template_questions DROP COLUMN state;
        ALTER TABLE template_questions
        ADD COLUMN state ENUM('not_present', 'optional', 'required') NOT NULL DEFAULT 'optional';
      `);
      console.log('✅ Reverted state ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`�yeong Failed to revert template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
};
