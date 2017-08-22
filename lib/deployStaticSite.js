const inquirer = require('inquirer');
const chalk = require('chalk');
const { config, S3, SharedIniFileCredentials } = require('aws-sdk');
const fs = require('fs')
const mime = require('mime')
const path = require('path');
const AWS = require('aws-sdk')

module.exports = (args) => {
  const { Profile, Source = process.cwd() } = args;
  const s3 = new S3();
  
  config.credentials = new SharedIniFileCredentials({
    profile: Profile,
  });

  return bucketNamePrompt()
      .then(checkBucketName)
      .then(createBucket)
      .then(updateBucketOpts)
      .then(prepForUpload)
      .then(upload)
      .then(sendSuccess)
      .catch(sendError);
  
  function bucketNamePrompt() {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'bucketName',
        message: 'What is your bucket called?',
      }
    ])
  }
  
  function checkBucketName({ bucketName }) {
    return s3.headBucket({ Bucket: bucketName })
      .promise()
      .then(() => {
        return {
          Bucket: bucketName,
          status: 'update',
        };
      })
      .catch(handleCheckError);
    
    function handleCheckError(err) {
      switch (err.statusCode) {
        case 404:
          return {
            Bucket: bucketName,
            status: 'create',
          };
        case 403:
          throw new Error('That bucket is in use and you do not have permission to update it.');
        break;
        default:
          return {
            Bucket: bucketName,
            status: 'update',
          };
      }
    }
  }

  function createBucket({ status, Bucket }) {
    if (status !== 'create') {
      return Bucket;
    }

    const options = {
      Bucket,
      ACL: 'public-read',
    };
  
    return s3.createBucket(options)
      .promise()
      .then(data => data.Location);
  }

  function updateBucketOpts(bucketName) {
    return new Promise((resolve, reject) => {
      return Promise.resolve(putBucketWebsite(bucketName))
        .then(() => putBucketPolicy(bucketName))
        .then(() => resolve({ Bucket: bucketName }))
        .catch(reject);
    });
  }

  function putBucketWebsite(Bucket) {
    return s3.putBucketWebsite({
      Bucket,
      WebsiteConfiguration: {
        ErrorDocument: {
          Key: 'index.html',
        },
        IndexDocument: {
          Suffix: 'index.html',
        },
      },
    });
  }

  function putBucketPolicy(Bucket) {
    return s3.putBucketPolicy({
      Bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'Allow Public Access to All Objects',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${Bucket}/*`,
          },
        ],
      }),
    });
  }

  function prepForUpload({ Bucket }) {
    return {
      source: Source,
      bucket: Bucket,
    }
  }

  function upload({ source, bucket, prefix }) {
    return new Promise((resolve, reject) => {
      fs.readdir(source, (err, files) => {
        if (err) {
          return reject(err);
        }
  
        if (!prefix && (!files || !files.length)) {
          return reject({
            message: 'Source folder is empty.'
          });
        }
  
        resolve(files);
      });
    })
      .then(files => {
        return Promise.all(files.map(file => {
          const filePath = path.join(source, file)
  
          if (fs.lstatSync(filePath).isDirectory()) {
            return upload({
              source: filePath,
              bucket: bucket,
              prefix: (prefix ? prefix : '') + file + '/',
            });
          }
  
          return uploadFile(file, filePath, bucket, prefix || '')
        }))
      })
  }

  function uploadFile(fileName, filePath, bucket, prefix = '') {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, fileContent) => {
        if (err) {
          return reject(err);
        }
  
        resolve(fileContent);
      });
    })
      .then(fileContent => {
        return s3.putObject({
          Bucket: bucket,
          Key: prefix + fileName,
          ContentType: mime.lookup(fileName),
          Body: fileContent,
          ACL: 'public-read'
        }).promise()
      })
  }
}

function sendSuccess(msg) {
  return console.log(chalk.blue('Project uploaded successfully!'));
}

function sendError(err) {
  return console.log(chalk.red(err));
}
