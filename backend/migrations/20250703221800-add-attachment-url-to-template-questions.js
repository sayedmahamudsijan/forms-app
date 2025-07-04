'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check for and remove redundant foreign key constraint on template_id
      const constraints = await queryInterface.sequelize.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'template_questions'
         AND constraint_type = 'FOREIGN KEY'
         AND constraint_name LIKE '%template_id_fkey%';`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      for (const constraint of constraints) {
        await queryInterface.removeConstraint('template_questions', constraint.constraint_name);
        console.log(`✅ Removed foreign key constraint ${constraint.constraint_name} from template_questions`, {
          timestamp: new Date().toISOString(),
        });
      }
      if (constraints.length === 0) {
        console.log('✅ No redundant template_id foreign key constraints found in template_questions', {
          timestamp: new Date().toISOString(),
        });
      }

      // Check if attachment_url column exists before attempting to add
      const table = await queryInterface.describeTable('template_questions');
      if (!table.attachment_url) {
        await queryInterface.addColumn('template_questions', 'attachment_url', {
          type: Sequelize.STRING,
          allowNull: true,
        });
        console.log('✅ Added attachment_url column in template_questions', {
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log('✅ attachment_url column already exists in template_questions, skipping addition', {
          timestamp: new Date().toISOString(),
        });
      }

      // Ensure min, max, min_label, max_label columns exist
      if (!table.min) {
        await queryInterface.addColumn('template_questions', 'min', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }
      if (!table.max) {
        await queryInterface.addColumn('template_questions', 'max', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }
      if (!table.min_label) {
        await queryInterface.addColumn('template_questions', 'min_label', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      if (!table.max_label) {
        await queryInterface.addColumn('template_questions', 'max_label', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      console.log('✅ Added/Verified min, max, min_label, max_label columns in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Verify type ENUM
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_template_questions_type'
            GROUP BY t.oid
            HAVING ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)::text[] @> ARRAY['string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time']::text[]
          ) THEN
            ALTER TABLE template_questions DROP COLUMN IF EXISTS type;
            CREATE TYPE enum_template_questions_type AS ENUM ('string', 'text', 'integer', 'checkbox', 'select', 'multiple_choice', 'dropdown', 'linear_scale', 'date', 'time');
            ALTER TABLE template_questions
            ADD COLUMN type enum_template_questions_type NOT NULL;
          END IF;
        END $$;
      `);
      console.log('✅ Verified/Updated type ENUM in template_questions', {
        timestamp: new Date().toISOString(),
      });

      // Verify state ENUM
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_template_questions_state'
            GROUP BY t.oid
            HAVING ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)::text[] @> ARRAY['not_present', 'optional', 'required']::text[]
          ) THEN
            ALTER TABLE template_questions DROP COLUMN IF EXISTS state;
            CREATE TYPE enum_template_questions_state AS ENUM ('not_present', 'optional', 'required');
            ALTER TABLE template_questions
            ADD COLUMN state enum_template_questions_state NOT NULL DEFAULT 'optional';
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
      console.warn(`⚠️ Failed to revert template_questions: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
};
