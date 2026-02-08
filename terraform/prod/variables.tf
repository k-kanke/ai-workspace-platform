variable "project" {
  type        = string
  description = "Project identifier for naming."
}

variable "aws_region" {
  type        = string
  description = "AWS region for S3."
  default     = "ap-northeast-1"
}

variable "bucket_name" {
  type        = string
  description = "S3 bucket name for frontend."
}

variable "price_class" {
  type        = string
  description = "CloudFront price class."
  default     = "PriceClass_200"
}

variable "basic_user" {
  type        = string
  description = "Basic auth username."
  sensitive   = true
}

variable "basic_pass" {
  type        = string
  description = "Basic auth password."
  sensitive   = true
}
