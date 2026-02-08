terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "frontend" {
  source = "./frontend"

  project     = var.project
  bucket_name = var.bucket_name

  basic_user = var.basic_user
  basic_pass = var.basic_pass

  price_class = var.price_class
}
