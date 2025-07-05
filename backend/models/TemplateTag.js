module.exports = (sequelize, DataTypes) => {
  const TemplateTag = sequelize.define('TemplateTag', {
    template_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    tag_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  }, {
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['tag_id'] },
    ],
  });

  TemplateTag.associate = (models) => {
    TemplateTag.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
    TemplateTag.belongsTo(models.Tag, { foreignKey: 'tag_id', as: 'Tag', onDelete: 'CASCADE' });
  };

  return TemplateTag;
};
