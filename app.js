const express = require('express');
const authMiddleware = require('./src/middleware/auth');
const bodyParser = require('body-parser');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const videoRoutes = require('./src/routes/video.route');
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/videos", authMiddleware, videoRoutes);
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Unexpected field. Expected "file" field.' });
        }
    }
    next(err);
});

module.exports = app;