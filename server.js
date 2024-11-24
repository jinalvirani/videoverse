const app = require('./app');
const PORT = process.env.PORT || 3000;
let server;
server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const getServerInstance = () => {
    return server
}

module.exports = { app, getServerInstance };
