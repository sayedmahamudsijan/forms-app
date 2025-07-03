module.exports = (sequelize, DataTypes) => {
  const TemplatePermission = sequelize.define('TemplatePermission', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['user_id'] },
    ],
  });

  TemplatePermission.associate = (models) => {
    TemplatePermission.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
    TemplatePermission.belongsTo(models.User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
  };

  return TemplatePermission;
};