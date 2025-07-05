'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Tag extends Model {
    static associate(models) {
      Tag.belongsToMany(models.Template, { 
        through: models.TemplateTag, // Use TemplateTag model instead of table name
        foreignKey: 'tag_id', 
        otherKey: 'template_id', 
        as: 'Templates',
        onDelete: 'CASCADE' 
      });
    }
  }

  Tag.init({
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    name: { 
      type: DataTypes.STRING, 
      unique: true, 
      allowNull: false 
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
    modelName: 'Tag',
    tableName: 'Tags',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['name'], unique: true },
    ],
  });

  return Tag;
};
