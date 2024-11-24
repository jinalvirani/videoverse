const request = require('supertest');
const app = require('../../app');
const fs = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const { generatePresignedUrl, uploadToS3 } = require('../utils/s3.util')
const { getServerInstance } = require('../../server')

jest.spyOn(fs, 'unlinkSync').mockImplementation((path) => { });
jest.mock("../utils/s3.util", () => ({
    downloadFromS3: jest.fn(),
    uploadToS3: jest.fn(() => ({
        Location: "https://s3.amazonaws.com/fakebucket/videos/sample.mp4",
    })),
    generatePresignedUrl: jest.fn(() => "https://s3.amazonaws.com/fakebucket/videos/sample.mp4"),
}));
jest.mock("../utils/video.util", () => ({
    trimVideo: jest.fn(),
    cleanUpFiles: jest.fn(),
    mergeVideos: jest.fn(),
}));

describe('Video Routes', () => {
    let videoId = ''
    let videoId2 = ''

    beforeAll(() => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 5.25 } });
        });
    });

    afterAll((done) => {
        const server = getServerInstance();
        server.close(done);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should upload a video successfully', async () => {
        const mockFile = {
            path: 'test.mp4',
            file_name: 'test.mp4',
            mimetype: 'video/mp4',
            size: 1024,
        };

        let response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', Buffer.from('dummy content'), 'test.mp4')

        let response2 = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', Buffer.from('dummy content'), 'test.mp4')
        videoId2 = response2.body.id;
        expect(response.status).toBe(200);
        videoId = response.body.id;
        expect(response.body.file_name).toContain(mockFile.file_name);
    });

    it('Should handle invalid file type on upload', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 5.25 } });
        });

        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', Buffer.from('dummy content'), 'invalid.txt')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid file type. Allowed types are mp4, avi, mov, mkv.');
    });

    it('Should trim a video successfully', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 5.25 } });
        });
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: 1, end: 2 })
        expect(response.status).toBe(200);
    });

    it('Should handle invalid start and end times during trim', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: -5, end: 100 })
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid start or end times.');
    });

    it('Should merge videos successfully', async () => {
        const response = await request(app)
            .post('/videos/merge')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ videoIds: [videoId, videoId2] })
        expect(response.status).toBe(200)
        expect(response.body.message).toBe('Video merged successfully');
        expect(response.body.url).toBe('https://s3.amazonaws.com/fakebucket/videos/sample.mp4');
    });

    it('Should generate a shareable link', async () => {
        const response = await request(app)
            .get(`/videos/${videoId}/share`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
        expect(response.status).toBe(200);
        expect(response.body.url).toBe('https://s3.amazonaws.com/fakebucket/videos/sample.mp4');
    });

    it('Should return 403 for missing token', async () => {
        const response = await request(app)
            .post('/videos')
            .attach('file', Buffer.from('dummy content'), 'invalid.txt')
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Unauthorized');
    });

    it('Should return multer unexpected file error', async () => {
        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('wrongName', Buffer.from('dummy content'), 'invalid.txt')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Unexpected field. Expected "file" field.');
    });

    it('Should return a validation error when the file is not provided', async () => {
        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', '', 'invalid.txt')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No file uploaded.');
    });

    it('Should validate the file size and return an error if it exceeds the limit', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 5.25 } });
        });
        const bufferSize = 5 * 1024 * 1024 + 1; // 5 MB + 1 byte
        const largeBuffer = Buffer.alloc(bufferSize, 'a');
        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', largeBuffer, 'test.mp4')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('File size exceeds the maximum limit of 5 MB.');
    });

    it('Should validate the file duration and return an error if it is outside the allowed range', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 0.1 } });
        });
        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', Buffer.from('dummy content'), 'test.mp4')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe(`Video duration must be between ${process.env.MIN_DURATION_SECS} and ${process.env.MAX_DURATION_SECS} seconds.`);
    });

    it('Should return an error when the video is not found in the database', async () => {
        const response = await request(app)
            .patch(`/videos/1/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: -5, end: 100 })
        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Video not found.');
    });

    it('Should return an error if a user attempts to trim a video they do not own', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_2')
            .send({ start: 1, end: 2 })
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('User can can only trim own video.');
    });
    it('Should return an error when start and end parameters are missing in the trim request', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({})
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Start or end parameter is required.');
    });

    it('Should return an error when start and end parameters are invalid', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: 'wrong' })
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Start, end or duration parameters must be numbers.');
    });

    it('Should return an error when start and end parameters are out of range', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: 1, duration: 10 })
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid duration times.');
    });

    it('Should return an error when the end parameter exceeds the video\'s total duration', async () => {
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ end: 1, duration: 10 })
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid duration times.');
    });

    it('Should return an error if less than 2 video IDs are provided for merging', async () => {
        const response = await request(app)
            .post('/videos/merge')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ videoIds: [] })
        expect(response.status).toBe(400)
        expect(response.body.message).toBe('At least two video IDs are required.');
    });

    it('Should return an error if less than 2 video IDs are provided for merging [database]', async () => {
        const response = await request(app)
            .post('/videos/merge')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ videoIds: [videoId, videoId] })
        expect(response.status).toBe(400)
        expect(response.body.message).toBe('At least two video IDs are required.');
    });

    it('Should return an error when trying to generate a link for a non-existent or invalid video', async () => {
        const response = await request(app)
            .get(`/videos/1/share`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Video not found.');
    });

    it('Should return an error if a user attempts to generate a shareable link for a video they do not own', async () => {
        const response = await request(app)
            .get(`/videos/${videoId}/share`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_2')
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('User can can only share own video.');
    });

    it('Should return a 500 status code when an error occurs during uploadToS3 in the /videos route', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((path, callback) => {
            callback(null, { format: { duration: 1 } });
        });
        uploadToS3.mockImplementation(() => {
            throw new Error('Unable to upload to s3');
        });
        const response = await request(app)
            .post('/videos')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .attach('file', Buffer.from('dummy content'), 'test.mp4')
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Unable to upload to s3');
    });

    it('Should return a 500 status code when an error occurs during uploadToS3 in the /merge route', async () => {
        uploadToS3.mockImplementation(() => {
            throw new Error('Unable to upload to s3');
        });
        const response = await request(app)
            .post('/videos/merge')
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ videoIds: [videoId, videoId2] })
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Unable to upload to s3');
    });


    it('Should return a 500 status code when an error occurs during the S3 upload process in the /trim route', async () => {
        uploadToS3.mockImplementation(() => {
            throw new Error('Unable to upload to s3');
        });
        const response = await request(app)
            .patch(`/videos/${videoId}/trim`)
            .set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1')
            .send({ start: 1, end: 2 })
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Unable to upload to s3');
    });

    it('Should return a 500 status code when an error occurs during generatePresignedUrl in the /share route', async () => {
        generatePresignedUrl.mockImplementation(() => {
            throw new Error('Unable to generate pre-signed URL');
        });
        const response = await request(app).get(`/videos/${videoId}/share`).set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_1');
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Unable to generate pre-signed URL');
    });

    it('Should return a 403 status code when an invalid token is provided', async () => {
        generatePresignedUrl.mockImplementation(() => {
            throw new Error('Unable to generate pre-signed URL');
        });
        const response = await request(app).get(`/videos/${videoId}/share`).set('Authorization', 'Bearer v!de0ver$eTe$tT0ken');
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Unauthorized');
    });

    it('Should return 403 if token is invalid or does not match user', async () => {
        generatePresignedUrl.mockImplementation(() => {
            throw new Error('Unable to generate pre-signed URL');
        });
        const response = await request(app).get(`/videos/${videoId}/share`).set('Authorization', 'Bearer v!de0ver$eTe$tT0ken_11');
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Unauthorized');
    });

    it('Should return 403 if token is invalid or does not match user token', async () => {
        generatePresignedUrl.mockImplementation(() => {
            throw new Error('Unable to generate pre-signed URL');
        });
        const response = await request(app).get(`/videos/${videoId}/share`).set('Authorization', 'Bearer v!de0ver$eTe$tT0kn_1');
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Unauthorized');
    });
});
