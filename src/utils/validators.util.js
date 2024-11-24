const ffmpeg = require('fluent-ffmpeg');

//Allowed file types (MIME types for videos)
const isValidMimeType = (file) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];
    if (!allowedTypes.includes(file.mimetype))
        return false;
    else
        return true;
}

// File size limit in bytes
const isValidSize = (file) => {
    const limit = process.env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > limit)
        return false;
    else
        return true;
}

// Extract video metadata using ffmpeg
const isValidDuration = async (path) => {
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(path, (err, metadata) => {
            if (err) return reject(new Error('Error processing video'));
            resolve(metadata);
        });
    });

    const duration = metadata.format.duration;
    if (duration < process.env.MIN_DURATION_SECS || duration > process.env.MAX_DURATION_SECS)
        return false;
    else
        return duration;
};

module.exports = { isValidMimeType, isValidSize, isValidDuration }