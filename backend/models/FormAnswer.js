module.exports = (sequelize, DataTypes) => {
  const FormAnswer = sequelize.define('FormAnswer', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    form_id: { type: DataTypes.INTEGER, allowNull: false },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['form_id'] },
      { fields: ['question_id'] },
    ],
  });

  FormAnswer.associate = (models) => {
    FormAnswer.belongsTo(models.Form, { foreignKey: 'form_id', as: 'Form', onDelete: 'CASCADE' });
    FormAnswer.belongsTo(models.TemplateQuestion, { foreignKey: 'question_id', as: 'TemplateQuestion', onDelete: 'CASCADE' });
  };

  return FormAnswer;
};