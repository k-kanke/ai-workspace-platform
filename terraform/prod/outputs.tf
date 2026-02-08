output "frontend_bucket" {
  value       = module.frontend.bucket_name
  description = "S3 bucket for frontend."
}

output "cloudfront_domain" {
  value       = module.frontend.cloudfront_domain
  description = "CloudFront distribution domain."
}
