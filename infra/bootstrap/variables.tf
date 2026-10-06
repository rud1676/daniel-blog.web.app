variable "project_id" {
  description = "GCP 프로젝트 ID. 전역 유일, 생성 후 변경 불가. Firebase 기본 주소가 <id>.web.app이 된다."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "소문자로 시작하고 소문자·숫자·하이픈으로 6~30자여야 한다."
  }
}

variable "project_name" {
  description = "콘솔에 보이는 표시 이름 (변경 가능)"
  type        = string
  default     = "daniel-blog"
}

variable "billing_account_id" {
  description = "블로그 전용 결제 계정 ID (예: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "region" {
  description = "state 버킷 리전. Cloud Storage 상시 무료 한도는 us-central1/us-east1/us-west1에만 있다."
  type        = string
  default     = "us-central1"
}

variable "monthly_budget_krw" {
  description = "월 예산(원). 넘으면 메일 알림만 오고 청구가 막히지는 않는다."
  type        = number
  default     = 1000
}
