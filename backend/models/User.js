module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    language: { type: DataTypes.STRING, defaultValue: 'en' },
    theme: { type: DataTypes.STRING, defaultValue: 'light' },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    odoo_token: { type: DataTypes.STRING, allowNull: true }, // Added odoo_token field
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['email'], unique: true },
    ],
  });

  User.associate = (models) => {
    User.hasMany(models.Template, { foreignKey: 'user_id', as: 'Templates', onDelete: 'CASCADE' });
    User.hasMany(models.Form, { foreignKey: 'user_id', as: 'Forms', onDelete: 'CASCADE' });
    User.hasMany(models.Comment, { foreignKey: 'user_id', as: 'Comments', onDelete: 'CASCADE' });
    User.hasMany(models.Like, { foreignKey: 'user_id', as: 'Likes', onDelete: 'CASCADE' });
    User.hasMany(models.TemplatePermission, { foreignKey: 'user_id', as: 'TemplatePermissions', onDelete: 'CASCADE' });
  };

  return User;
};
