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
    Tag.belongsToMany(models.Template, { 
      through: 'template_tags', 
      foreignKey: 'tag_id', 
      otherKey: 'template_id', 
      as: 'Templates',
      onDelete: 'CASCADE' 
    });
  };

  return Tag;
};
