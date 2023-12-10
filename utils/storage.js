const AWS = require("aws-sdk");
const fs = require('fs');
const path = require('path');

// 

const s3 = new AWS.S3();
const bucketName = 'cyclic-thoughtful-lion-visor-us-west-2';

/**
 * Uploads a file to S3 and returns a signed URL for the uploaded file.
 * @param {string} filePath - The path to the file to be uploaded.
 * @param {string} key - The destination path within the S3 bucket.
 * @param {number} expiration - The expiration time for the signed URL in seconds.
 * @returns {Promise<string>} - A Promise that resolves with the signed URL.
 */
const uploadFileToS3 = (filePath, key, expiration = 300) => {
    const fileContent = fs.readFileSync(filePath);

    return s3.upload({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
    }).promise()
        .then(data => {
            const signedUrl = s3.getSignedUrl('getObject', {
                Bucket: bucketName,
                Key: key,
                Expires: expiration,
            });
            return signedUrl;
        });
};

// Example usage in a controller
// const imagePath = path.join(__dirname, 'path/to/your/image.jpg');
// const s3Key = 'test/image.jpg';

// uploadFileToS3(imagePath, s3Key)
//     .then(signedUrl => {
//         console.log('File uploaded successfully. Signed URL:', signedUrl);
//         // You can now use the signed URL as needed in your controller.
//     })
//     .catch(error => {
//         console.error('Error uploading file:', error);
//         // Handle the error in your controller.
//     });

module.exports = { uploadFileToS3 };
