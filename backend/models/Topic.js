module.exports = (sequelize, DataTypes) => {
  const Topic = sequelize.define('Topic', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['name'], unique: true },
    ],
  });

  Topic.associate = (models) => {
    Topic.hasMany(models.Template, { foreignKey: 'topic_id', as: 'Templates', onDelete: 'RESTRICT' });
  };

  return Topic;
};