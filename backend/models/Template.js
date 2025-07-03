module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define('Template', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.STRING, allowNull: true },
    topic_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'Topics', key: 'id' }
    },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    search_vector: { type: DataTypes.TSVECTOR, allowNull: true },
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'Templates',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['topic_id'] },
      { name: 'template_search_idx', fields: ['search_vector'], using: 'GIN' },
    ],
  });

  Template.associate = (models) => {
    Template.belongsTo(models.User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
    Template.belongsTo(models.Topic, { foreignKey: 'topic_id', as: 'Topic', onDelete: 'RESTRICT' });
    Template.hasMany(models.TemplatePermission, { foreignKey: 'template_id', as: 'TemplatePermissions', onDelete: 'CASCADE' });
    Template.hasMany(models.TemplateTag, { foreignKey: 'template_id', as: 'TemplateTags', onDelete: 'CASCADE' });
    Template.hasMany(models.TemplateQuestion, { foreignKey: 'template_id', as: 'TemplateQuestions', onDelete: 'CASCADE' });
    Template.hasMany(models.Form, { foreignKey: 'template_id', as: 'Forms', onDelete: 'CASCADE' });
    Template.hasMany(models.Comment, { foreignKey: 'template_id', as: 'Comments', onDelete: 'CASCADE' });
    Template.hasMany(models.Like, { foreignKey: 'template_id', as: 'Likes', onDelete: 'CASCADE' });
  };

  return Template;
};