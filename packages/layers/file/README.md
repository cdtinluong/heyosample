# The file layer

The layer to support actions with s3 like multipart upload, multipart download, complete multipart uploading, abort multipart uploading

Since S3 MRAP exists, it was the logical choice to pick to handle low latency upload/download for users depending on regions.
We implemented a multi-part upload/download with pre-signed URLs in order to allow this.
However, we need to use `aws-sdk version 3` for MRAP, and it need the library name `@aws-sdk/signature-v4-crt` and it make to lambda function size increase to ~10Mb, that's why we create this layer so that the size of lambda function will be reduce and can be invoked fast as normal