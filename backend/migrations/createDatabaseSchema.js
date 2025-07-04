'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Users table
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
    });

    // Create Topics table
    await queryInterface.createTable('topics', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Create Tags table
    await queryInterface.createTable('tags', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Create Templates table
    await queryInterface.createTable('templates', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      topic_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'topics', key: 'id' },
        onDelete: 'RESTRICT',
      },
      is_public: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      search_vector: { type: Sequelize.TSVECTOR, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Template Questions
    await queryInterface.createTable('template_questions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('string', 'text', 'integer', 'checkbox', 'select'),
        allowNull: false,
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      is_visible_in_results: { type: Sequelize.BOOLEAN, defaultValue: true },
      order: { type: Sequelize.INTEGER, allowNull: false },
      state: {
        type: Sequelize.ENUM('not_present', 'optional', 'required'),
        defaultValue: 'optional',
      },
      options: { type: Sequelize.JSON, allowNull: true },
    });

    // Forms
    await queryInterface.createTable('forms', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_like: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Form Answers
    await queryInterface.createTable('form_answers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      form_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'forms', key: 'id' },
        onDelete: 'CASCADE',
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'template_questions', key: 'id' },
        onDelete: 'CASCADE',
      },
      value: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Comments
    await queryInterface.createTable('comments', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Likes
    await queryInterface.createTable('likes', {
      template_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Template Tags
    await queryInterface.createTable('template_tags', {
      template_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      tag_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'tags', key: 'id' },
        onDelete: 'CASCADE',
      },
    });

    // Template Permissions
    await queryInterface.createTable('template_permissions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // Add necessary indexes
    await queryInterface.addIndex('templates', ['user_id']);
    await queryInterface.addIndex('templates', ['topic_id']);
    await queryInterface.addIndex('templates', ['search_vector'], { using: 'GIN' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('template_permissions');
    await queryInterface.dropTable('template_tags');
    await queryInterface.dropTable('likes');
    await queryInterface.dropTable('comments');
    await queryInterface.dropTable('form_answers');
    await queryInterface.dropTable('forms');
    await queryInterface.dropTable('template_questions');
    await queryInterface.dropTable('templates');
    await queryInterface.dropTable('tags');
    await queryInterface.dropTable('topics');
    await queryInterface.dropTable('users');
  },
};
