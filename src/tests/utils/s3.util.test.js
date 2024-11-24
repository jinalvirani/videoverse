const { uploadToS3, generatePresignedUrl, downloadFromS3 } = require('../../utils/s3.util'); // Adjust path to your utils
const fs = require('node:fs');

jest.mock('aws-sdk', () => ({
    S3: jest.fn(() => ({
        upload: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({
                Bucket: 'test-bucket',
                Key: 'test-key',
                Location: 'https://s3.amazonaws.com/test-bucket/test-key',
                ETag: '"etag-mock"',
            }),
        }),
        getSignedUrl: jest.fn((operation, params, callback) => {
            if (operation === 'getObject') {
                return 'https://s3.amazonaws.com/test-bucket/test-key?AWSAccessKeyId=mocked';
            }
        }),
        getObject: jest.fn(() => ({
            createReadStream: jest.fn(() => {
                const { PassThrough } = require('stream');
                const passThroughStream = new PassThrough();
                setTimeout(() => {
                    passThroughStream.emit('data', 'mock file content');
                    passThroughStream.emit('end');
                    passThroughStream.emit('close');
                }, 10);
                return passThroughStream;
            }),
        })),
    })),
}));

jest.mock('fs', () => ({
    createReadStream: jest.fn(() => ({
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn(),
    })),
    createWriteStream: jest.fn(() => {
        const mockStream = {
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn((event, callback) => {
                if (event === 'close') {
                    setTimeout(callback, 10);
                }
                if (event === 'error') {
                    callback(new Error('Write stream error'));
                }
            }),
        };
        return mockStream;
    }),
}));

describe('S3 Helper Functions', () => {
    afterAll(() => {
        fs.unlinkSync('test.txt');
        fs.unlinkSync('test-download.txt');
    });

    beforeAll(() => {
        fs.writeFileSync('test.txt', 'This is a dummy content for testing.', 'utf-8');
    });

    it('Should upload a file to S3', async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        const filePath = 'test.txt';
        const contentType = 'text/plain';
        const uploadResult = await uploadToS3(bucket, key, filePath, contentType);
        expect(uploadResult).toEqual({
            Bucket: 'test-bucket',
            Key: 'test-key',
            Location: 'https://s3.amazonaws.com/test-bucket/test-key',
            ETag: '"etag-mock"',
        });
    });

    it('Should generate a pre-signed URL', async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        const url = await generatePresignedUrl(bucket, key);
        expect(url).toBe('https://s3.amazonaws.com/test-bucket/test-key?AWSAccessKeyId=mocked');
    });

    it('Should download a file from S3', async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        const downloadPath = 'test-download.txt';
        const result = await downloadFromS3(bucket, key, downloadPath);
    });
});
