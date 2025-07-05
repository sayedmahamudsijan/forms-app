'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TemplateTag extends Model {
    static associate(models) {
      TemplateTag.belongsTo(models.Template, { 
        foreignKey: 'template_id', 
        as: 'Template', 
        onDelete: 'CASCADE' 
      });
      TemplateTag.belongsTo(models.Tag, { 
        foreignKey: 'tag_id', 
        as: 'Tag', 
        onDelete: 'CASCADE' 
      });
    }
  }

  TemplateTag.init({
    template_id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      allowNull: false,
      references: { model: 'Templates', key: 'id' }
    },
    tag_id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      allowNull: false,
      references: { model: 'Tags', key: 'id' }
    },
    created_at: { 
      type: DataTypes.DATE, 
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: { 
      type: DataTypes.DATE, 
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
  }, {
    sequelize,
    modelName: 'TemplateTag',
    tableName: 'template_tags',
    timestamps: true, // Changed from false to true
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['tag_id'] },
    ],
  });

  return TemplateTag;
};
