module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define('Like', {
    template_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['user_id'] },
    ],
  });

  Like.associate = (models) => {
    Like.belongsTo(models.Template, { foreignKey: 'template_id', as: 'Template', onDelete: 'CASCADE' });
    Like.belongsTo(models.User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
  };

  return Like;
};