const ffmpeg = require('fluent-ffmpeg');
const fs = require('node:fs');

const trimVideo = (videoPath, start, end, duration, trimmedPath, videDuration) => {
    const command = ffmpeg(videoPath);
    if (start != null && !end && !duration) {
        command.setStartTime(start);
    }
    else if (start != null && duration) {
        command.setStartTime(start).setDuration(duration);
    }
    else if (end != null && !start && !duration) {
        command.setStartTime(0).setDuration(end);
    }
    else if (end != null && duration) {
        command.setStartTime(videDuration - duration - end).setDuration(duration);
    }
    else {
        const trimDuration = end - start;
        command.setStartTime(start).setDuration(trimDuration);
    }
    return new Promise((resolve, reject) => {
        command
            .output(trimmedPath)
            .on("end", () => resolve(trimmedPath))
            .on("error", (err) => reject(err))
            .run();
    });
};

const cleanUpFiles = (files) => {
    files.forEach((file) => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });
}

const mergeVideos = (videoPaths, outputFilePath) => {
    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg();

        videoPaths.forEach((videoPath) => ffmpegCommand.input(videoPath));

        ffmpegCommand
            .mergeToFile(outputFilePath)
            .on("end", () => resolve(outputFilePath))
            .on("error", (err) => reject(err));
    });
}

module.exports = { trimVideo, cleanUpFiles, mergeVideos }