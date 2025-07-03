module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define('Tag', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, unique: true, allowNull: false },
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['name'], unique: true },
    ],
  });

  Tag.associate = (models) => {
    Tag.hasMany(models.TemplateTag, { foreignKey: 'tag_id', as: 'TemplateTags', onDelete: 'CASCADE' });
  };

  return Tag;
};