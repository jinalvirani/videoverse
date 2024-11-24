const fs = require('node:fs');
const AWS = require('aws-sdk');

// AWS S3 Configuration
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const downloadFromS3 = async (bucket, key, downloadPath) => {
    const params = { Bucket: bucket, Key: key };
    const file = fs.createWriteStream(downloadPath);
    return new Promise((resolve, reject) => {
        s3.getObject(params).createReadStream()
            .pipe(file)
            .on("close", resolve)
            .on("error", reject);
    });
};

const uploadToS3 = async (bucket, key, filePath, contentType) => {
    const fileContent = fs.createReadStream(filePath);
    const params = {
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType
    };
    return s3.upload(params).promise();
};

const generatePresignedUrl = async (bucket, key) => {
    const params = {
        Bucket: bucket,
        Key: key,
        Expires: 60 * 5, // URL expires in 5 minutes
    };
    return s3.getSignedUrl('getObject', params);
}

module.exports = { downloadFromS3, uploadToS3, generatePresignedUrl }