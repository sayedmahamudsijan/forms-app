module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define('Comment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['user_id'] },
    ],
  });

  Comment.associate = (models) => {
    Comment.belongsTo(models.User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
    Comment.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
  };

  return Comment;
};