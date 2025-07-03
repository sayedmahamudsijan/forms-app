module.exports = (sequelize, DataTypes) => {
  const Form = sequelize.define('Form', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_like: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['user_id'] },
    ],
  });

  Form.associate = (models) => {
    Form.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
    Form.belongsTo(models.User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
    Form.hasMany(models.FormAnswer, { foreignKey: 'form_id', as: 'FormAnswers', onDelete: 'CASCADE' });
  };

  return Form;
};