output "bucket_name" {
  value       = aws_s3_bucket.frontend.bucket
  description = "Frontend S3 bucket name."
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.frontend.domain_name
  description = "CloudFront distribution domain."
}
