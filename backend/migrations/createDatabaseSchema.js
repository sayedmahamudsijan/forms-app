'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Creating Users table
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: Sequelize.STRING, unique: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      password: { type: Sequelize.STRING, allowNull: false },
      is_admin: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_blocked: { type: Sequelize.BOOLEAN, defaultValue: false },
      language: { type: Sequelize.STRING, defaultValue: 'en' },
      theme: { type: Sequelize.STRING, defaultValue: 'light' },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating Topics table
    await queryInterface.createTable('topics', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating Tags table
    await queryInterface.createTable('tags', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating Templates table
    await queryInterface.createTable('templates', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      topic_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'topics', key: 'id' }, onDelete: 'RESTRICT' },
      is_public: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      search_vector: { type: Sequelize.TSVECTOR, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating TemplateQuestions table
    await queryInterface.createTable('template_questions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.ENUM('string', 'text', 'integer', 'checkbox', 'select'), allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      is_visible_in_results: { type: Sequelize.BOOLEAN, defaultValue: true },
      order: { type: Sequelize.INTEGER, allowNull: false },
      state: { type: Sequelize.ENUM('not_present', 'optional', 'required'), defaultValue: 'optional' },
      options: { type: Sequelize.JSON, allowNull: true },
    }, { ifNotExists: true });

    // Creating Forms table
    await queryInterface.createTable('forms', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_like: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating FormAnswers table
    await queryInterface.createTable('form_answers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      form_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'forms', key: 'id' }, onDelete: 'CASCADE' },
      question_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'template_questions', key: 'id' }, onDelete: 'CASCADE' },
      value: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating Comments table
    await queryInterface.createTable('comments', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating Likes table
    await queryInterface.createTable('likes', {
      template_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Creating TemplateTags table
    await queryInterface.createTable('template_tags', {
      template_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      tag_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: 'tags', key: 'id' }, onDelete: 'CASCADE' },
    }, { ifNotExists: true });

    // Creating TemplatePermissions table
    await queryInterface.createTable('template_permissions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'templates', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Adding indexes with explicit names and error handling
    try {
      await queryInterface.addIndex('users', ['email'], {
        unique: true,
        name: 'users_email_unique',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for users.email: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('topics', ['name'], {
        unique: true,
        name: 'topics_name_unique',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for topics.name: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('tags', ['name'], {
        unique: true,
        name: 'tags_name_unique',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for tags.name: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('templates', ['user_id'], { name: 'templates_user_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for templates.user_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('templates', ['topic_id'], { name: 'templates_topic_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for templates.topic_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('templates', ['search_vector'], {
        name: 'template_search_idx',
        using: 'GIN',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for templates.search_vector: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('template_questions', ['template_id'], {
        name: 'template_questions_template_id_idx',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for template_questions.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('forms', ['template_id'], { name: 'forms_template_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for forms.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('forms', ['user_id'], { name: 'forms_user_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for forms.user_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('form_answers', ['form_id'], { name: 'form_answers_form_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for form_answers.form_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('form_answers', ['question_id'], {
        name: 'form_answers_question_id_idx',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for form_answers.question_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('comments', ['template_id'], { name: 'comments_template_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for comments.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('comments', ['user_id'], { name: 'comments_user_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for comments.user_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('likes', ['template_id'], { name: 'likes_template_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for likes.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('likes', ['user_id'], { name: 'likes_user_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for likes.user_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('template_tags', ['template_id'], {
        name: 'template_tags_template_id_idx',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for template_tags.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('template_tags', ['tag_id'], { name: 'template_tags_tag_id_idx', ifNotExists: true });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for template_tags.tag_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('template_permissions', ['template_id'], {
        name: 'template_permissions_template_id_idx',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for template_permissions.template_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await queryInterface.addIndex('template_permissions', ['user_id'], {
        name: 'template_permissions_user_id_idx',
        ifNotExists: true,
      });
    } catch (error) {
      console.warn(`⚠️ Skipping index creation for template_permissions.user_id: ${error.message}`, {
        timestamp: new Date().toISOString(),
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('template_permissions', { ifExists: true });
    await queryInterface.dropTable('template_tags', { ifExists: true });
    await queryInterface.dropTable('likes', { ifExists: true });
    await queryInterface.dropTable('comments', { ifExists: true });
    await queryInterface.dropTable('form_answers', { ifExists: true });
    await queryInterface.dropTable('forms', { ifExists: true });
    await queryInterface.dropTable('template_questions', { ifExists: true });
    await queryInterface.dropTable('templates', { ifExists: true });
    await queryInterface.dropTable('tags', { ifExists: true });
    await queryInterface.dropTable('topics', { ifExists: true });
    await queryInterface.dropTable('users', { ifExists: true });
  }
};