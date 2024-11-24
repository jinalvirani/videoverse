const { DataTypes } = require("sequelize");
const { sequelize } = require('../config/sequelize.js');

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = { sequelize, User };
