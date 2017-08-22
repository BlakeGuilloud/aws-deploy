function createBucket({ Bucket, Region }, s3) {
  const options = {
    Bucket,
    ACL: 'public-read',
  };

  return s3.createBucket(options)
    .promise()
    .then(res => res);
}

module.exports = createBucket;