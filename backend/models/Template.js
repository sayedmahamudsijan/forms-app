'use strict';

const { Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Template extends Model {
    static associate(models) {
      Template.belongsTo(models.User, { 
        foreignKey: 'user_id', 
        as: 'User', 
        onDelete: 'CASCADE' 
      });
      Template.belongsTo(models.Topic, { 
        foreignKey: 'topic_id', 
        as: 'Topic', 
        onDelete: 'RESTRICT' 
      });
      Template.hasMany(models.TemplatePermission, { 
        foreignKey: 'template_id', 
        as: 'TemplatePermissions', 
        onDelete: 'CASCADE' 
      });
      Template.hasMany(models.TemplateQuestion, { 
        foreignKey: 'template_id', 
        as: 'TemplateQuestions', 
        onDelete: 'CASCADE' 
      });
      Template.hasMany(models.Form, { 
        foreignKey: 'template_id', 
        as: 'Forms', 
        onDelete: 'CASCADE' 
      });
      Template.hasMany(models.Comment, { 
        foreignKey: 'template_id', 
        as: 'Comments', 
        onDelete: 'CASCADE' 
      });
      Template.hasMany(models.Like, { 
        foreignKey: 'template_id', 
        as: 'Likes', 
        onDelete: 'CASCADE' 
      });
      Template.belongsToMany(models.Tag, { 
        through: models.TemplateTag, // Use TemplateTag model instead of table name
        foreignKey: 'template_id', 
        otherKey: 'tag_id', 
        as: 'TemplateTags', // Changed from 'Tags' to match controller
        onDelete: 'CASCADE' 
      });
    }
  }

  Template.init({
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    user_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    title: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    image_url: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    topic_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'Topics', key: 'id' }
    },
    is_public: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false 
    },
    version: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 0 
    },
    search_vector: { 
      type: DataTypes.TSVECTOR, 
      allowNull: true 
    },
    created_at: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    updated_at: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
  }, {
    sequelize,
    modelName: 'Template',
    tableName: 'Templates',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['topic_id'] },
      { name: 'template_search_idx', fields: ['search_vector'], using: 'GIN' },
    ],
  });

  return Template;
};
