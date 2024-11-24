const { Video } = require('./video');
const { User } = require('./user.js');

Video.belongsTo(User, { foreignKey: 'userId' });

module.exports = { User, Video };
