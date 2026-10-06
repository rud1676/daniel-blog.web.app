terraform {
  required_version = ">= 1.9"

  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.5"
    }
  }

  # 버킷은 bootstrap 레이어가 만든다 (output tfstate_bucket).
  backend "gcs" {
    bucket = "daniel-blog-1676-tfstate"
    prefix = "main"
  }
}

# Firebase API는 사용자 인증(ADC)으로 부르면 quota 프로젝트를 요구한다 (bootstrap의 예산과 같은 이유).
provider "google-beta" {
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}
