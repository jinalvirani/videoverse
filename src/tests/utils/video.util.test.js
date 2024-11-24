const fs = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const { trimVideo, cleanUpFiles, mergeVideos } = require('../../utils/video.util');

jest.mock('node:fs');
jest.mock('fluent-ffmpeg', () => {
    return jest.fn().mockImplementation(() => {
        const mockCommand = {
            setStartTime: jest.fn().mockReturnThis(),
            setDuration: jest.fn().mockReturnThis(),
            input: jest.fn().mockReturnThis(),
            output: jest.fn().mockReturnThis(),
            run: jest.fn(),
            mergeToFile: jest.fn().mockReturnThis(),
            on: jest.fn(function(event, callback) {
                if (event === "end") {
                    setImmediate(() => callback());
                }
                if (event === "error") {
                    setImmediate(() => callback(new Error('Error trimming video')));
                }
                return this;
            }),
        };

        return mockCommand;
    });
});

describe('Video Utility Functions', () => {
    describe('Trim Video', () => {
        it('Should trim video with start time only', async () => {
            const videoPath = 'test-video.mp4';
            const start = 10;
            const trimmedPath = 'trimmed-video.mp4';
            await trimVideo(videoPath, start, null, null, trimmedPath);
        });

        it('Should trim video with start time and duration', async () => {
            const videoPath = 'test-video.mp4';
            const start = 10;
            const duration = 20;
            const trimmedPath = 'trimmed-video.mp4';
            await trimVideo(videoPath, start, null, duration, trimmedPath);
        });
        
        it('Should trim video with end time only', async () => {
            const videoPath = 'test-video.mp4';
            const end = 1;
            const trimmedPath = 'trimmed-video.mp4';
            await trimVideo(videoPath, null, end, null, trimmedPath, 30);
        });
        
        it('Should trim video with end time and duration', async () => {
            const videoPath = 'test-video.mp4';
            const end = 1;
            let duration = 20;
            const trimmedPath = 'trimmed-video.mp4';
            await trimVideo(videoPath, null, end, duration, trimmedPath,30);
        });
        
        it('Should trim video with start time and end', async () => {
            const videoPath = 'test-video.mp4';
            const start = 10;
            const end = 10;
            const trimmedPath = 'trimmed-video.mp4';
            await trimVideo(videoPath, start, end, null, trimmedPath,30);
        });
    });

    describe('Cleanup Files', () => {
        it('Should delete files if they exist', () => {
            const files = ['file1.mp4', 'file2.mp4'];
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockReturnValue(undefined);
            cleanUpFiles(files);
            files.forEach(file => {
                expect(fs.existsSync).toHaveBeenCalledWith(file);
                expect(fs.unlinkSync).toHaveBeenCalledWith(file);
            });
        });
    });

    describe('Merge videos', () => {
        it('Should merge multiple videos', async () => {
            const videoPaths = ['video1.mp4', 'video2.mp4'];
            const outputFilePath = 'merged-video.mp4';
            await mergeVideos(videoPaths, outputFilePath);
        });
    });
});
