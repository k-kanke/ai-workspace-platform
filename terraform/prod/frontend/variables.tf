variable "project" {
  type        = string
  description = "Project identifier."
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
