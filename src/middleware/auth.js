const { User } = require('../models/')
const authMiddleware = async (req, res, next) => {
    let token = req.headers['authorization'];
    if (!token || !token.startsWith('Bearer ')) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    token = token.split(' ')[1];
    let userId = token.split('_')[1];
    if (!userId) return res.status(403).send({ message: 'Unauthorized' });
    const user = await User.findOne({ where: { id: userId } });
    if (!user) return res.status(403).send({ message: 'Unauthorized' });
    if (token !== user.dataValues.token) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    req.userId = userId;
    next();
};

module.exports = authMiddleware;
