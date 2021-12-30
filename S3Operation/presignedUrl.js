const AWS = require('aws-sdk');
const getPresignedUrl = (uuid, filenameExtension) =>{
    const s3 = new AWS.S3({
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${uuid}.${filenameExtension}`,
        Expires: 30 * 60 * 4,
    };
    return new Promise((resolve, reject) => {
        s3.getSignedUrl('putObject', params, function(err, signedUrl) {
            if (err) {
                reject(err);
            } else {
                resolve(signedUrl);
            }
        })
    })
}

module.exports = [getPresignedUrl];