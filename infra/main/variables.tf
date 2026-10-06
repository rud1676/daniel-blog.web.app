variable "project_id" {
  description = "bootstrap 레이어가 만든 GCP 프로젝트 ID"
  type        = string
  default     = "daniel-blog-1676"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "site_id" {
  description = "Hosting 사이트 ID. 전역 유일하며 공개 주소가 <site_id>.web.app이 된다. 프로젝트 ID와 별개다."
  type        = string
  default     = "daniel-blog"
}
