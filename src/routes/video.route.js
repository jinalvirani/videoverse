const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { Video } = require("../models");
const { isValidMimeType, isValidSize, isValidDuration } = require('../utils/validators.util');
const { downloadFromS3, uploadToS3, generatePresignedUrl } = require('../utils/s3.util');
const { trimVideo, cleanUpFiles, mergeVideos } = require('../utils/video.util');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage: storage });
let router = express.Router();

router.post('/', upload.single('file'), async (req, res, next) => {
    try {
        // Validate input
        let file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        if (!isValidMimeType(file)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ message: 'Invalid file type. Allowed types are mp4, avi, mov, mkv.' });
        }

        if (!isValidSize(file)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ message: `File size exceeds the maximum limit of ${process.env.MAX_FILE_SIZE_MB} MB.` });
        }
        let duration = await isValidDuration(file.path);
        if (!duration) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ message: `Video duration must be between ${process.env.MIN_DURATION_SECS} and ${process.env.MAX_DURATION_SECS} seconds.` });
        }

        // Upload the video to S3
        const s3Data = await uploadToS3(process.env.AWS_BUCKET_NAME, `videos/${file.filename}`, file.path, file.mimetype);

        // Save to database
        const video = await Video.create({
            file_name: file.filename,
            size: file.size,
            duration: duration,
            mime_type: file.mimetype,
            userId: req.userId
        });

        // Clean up local file
        fs.unlinkSync(file.path);

        return res.status(200).json(video);
    } catch (error) {
        console.error('Error uploading video:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: error.message || 'Something went wrong' });
    }
});

router.patch("/:videoId/trim", async (req, res) => {
    let videoData;
    try {
        // Validate input
        const { videoId } = req.params
        videoData = await Video.findByPk(videoId);
        if (!videoData || !videoData.dataValues)
            return res.status(404).json({ message: "Video not found." });

        if (videoData && videoData.dataValues.userId != req.userId)
            return res.status(400).json({ message: "User can can only trim own video." });

        let video = videoData.dataValues;

        let { start, end, duration } = req.body;

        if (start == null && end == null) {
            return res.status(400).json({ message: "Start or end parameter is required." });
        }

        if ((start && isNaN(start)) || (end && isNaN(end)) || (duration && isNaN(duration))) {
            return res.status(400).json({ message: "Start, end or duration parameters must be numbers." });
        }
        if ((start && start < 0) || (start && start > video.duration) || ((end && end < 0) || (end > video.duration)) || (start && end && end <= start)) {
            return res.status(400).json({ message: "Invalid start or end times." });
        }
        if ((duration && (start + duration) > video.duration) || (duration && (video.duration - duration - end) < 0))
            return res.status(400).json({ message: "Invalid duration times." });

        // Download the original video from S3
        const videoPath = path.join(uploadDir, video.file_name);
        await downloadFromS3(process.env.AWS_BUCKET_NAME, `videos/${video.file_name}`, videoPath);

        // Trim the video
        const trimmedPath = path.join(uploadDir, `trimmed-${video.file_name}`);
        await trimVideo(videoPath, start, end, duration, trimmedPath, video.duration);

        // Upload the trimmed video to S3
        const s3Data = await uploadToS3(process.env.AWS_BUCKET_NAME, `videos/${video.file_name}`, trimmedPath, video.mime_type);

        // Update video trimed duration to db
        videoData.duration = await isValidDuration(trimmedPath);
        await videoData.save();

        // cleanup
        fs.unlinkSync(videoPath);
        fs.unlinkSync(trimmedPath);
        return res.status(200).json(videoData);
    } catch (error) {
        console.log(error)
        if (videoData) {
            fs.unlinkSync(path.join(uploadDir, videoData.file_name));
            fs.unlinkSync(path.join(uploadDir, `trimmed-${videoData.file_name}`));
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/merge', async (req, res, next) => {
    let tempFiles;
    let mergedFilePath;
    try {
        // Validate input
        const { videoIds } = req.body;
        if (!Array.isArray(videoIds) || videoIds.length < 2) {
            return res.status(400).json({ message: "At least two video IDs are required." });
        }
        const videos = await Video.findAll({
            where: { id: videoIds },
        });
        if (videos.length < 2)
            return res.status(400).json({ message: "At least two video IDs are required." });

        // Download the original video from S3
        tempFiles = [];
        const uploadDir = path.join(__dirname, "uploads");
        const mergedFileName = `merged-${Date.now()}.mp4`;
        let mergedFilePath = path.join(uploadDir, mergedFileName);
        for (const video of videos) {
            const tempFilePath = path.join(uploadDir, video.file_name);
            await downloadFromS3(
                process.env.AWS_BUCKET_NAME,
                `videos/${video.file_name}`,
                `${uploadDir}/${video.file_name}`
            )
            tempFiles.push(tempFilePath);
        }

        // Merge all videos
        await mergeVideos(tempFiles, mergedFilePath);
        await uploadToS3(process.env.AWS_BUCKET_NAME, `videos/${mergedFileName}`, mergedFilePath, 'video/mp4');

        // cleanup
        cleanUpFiles([...tempFiles, mergedFilePath]);

        // Generate signed URL after merge to view
        const url = await generatePresignedUrl(process.env.AWS_BUCKET_NAME, `videos/${mergedFileName}`)
        return res.status(200).json({ message: `Video merged successfully`, url: url });
    } catch (error) {
        console.log(error);
        cleanUpFiles([...tempFiles, mergedFilePath]);
        return res.status(500).json({ error: error.message });
    }
})
router.get('/:videoId/share', async (req, res, next) => {
    try {
        // Validate input
        const { videoId } = req.params;
        const video = await Video.findByPk(videoId);
        if (!video) return res.status(404).json({ message: "Video not found." });
        if (video && video.dataValues.userId != req.userId)
            return res.status(400).json({ message: "User can can only share own video." });

        // Generate signed URL
        const url = await generatePresignedUrl(process.env.AWS_BUCKET_NAME, `videos/${video.file_name}`)
        return res.status(200).json({
            url: url,
        });
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);;
        return res.status(500).json({ error: error.message });
    }
})

module.exports = router;