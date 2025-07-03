module.exports = (sequelize, DataTypes) => {
  const TemplateQuestion = sequelize.define('TemplateQuestion', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('string', 'text', 'integer', 'checkbox', 'select'), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    is_visible_in_results: { type: DataTypes.BOOLEAN, defaultValue: true },
    order: { type: DataTypes.INTEGER, allowNull: false },
    state: { type: DataTypes.ENUM('not_present', 'optional', 'required'), defaultValue: 'optional' },
    options: { type: DataTypes.JSON, allowNull: true }, // Stores options for 'select' type
  }, {
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
    ],
  });

  TemplateQuestion.associate = (models) => {
    TemplateQuestion.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
    TemplateQuestion.hasMany(models.FormAnswer, { foreignKey: 'question_id', as: 'FormAnswers', onDelete: 'CASCADE' });
  };

  return TemplateQuestion;
};