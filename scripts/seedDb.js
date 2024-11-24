const { User, Video } = require('../src/models/index');
seed();

async function seed() {
    await Video.sync({ force: true });
    await User.sync({ force: true });
    await Promise.all([
        User.create({
            id: 1,
            token: "v!de0ver$eTe$tT0ken_1"
        }),
        User.create({
            id: 2,
            token: "v!de0ver$eTe$tT0ken_2"
        }),
        User.create({
            id: 3,
            token: "v!de0ver$eTe$tT0ken_3"
        })
    ]);
}
