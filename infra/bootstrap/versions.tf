# 부트스트랩 레이어의 Terraform·provider 설정. 리소스는 기능별 파일에 있다 (project.tf · state.tf · budget.tf).
#
# 부트스트랩 레이어 — 다른 모든 레이어가 기대는 바닥을 만든다.
#   1. GCP 프로젝트 + 결제 계정 연결
#   2. Terraform state 버킷 (메인 레이어와 이 레이어 자신이 쓴다)
#   3. 월 예산 알림 (0원 유지 장치)
#
# state 버킷이 이 레이어에서 생기므로 첫 apply는 로컬 state로 하고,
# 끝나면 backend.tf 주석을 풀어 GCS로 옮긴다 (README 참고).

terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.5"
    }
  }
}

provider "google" {
  region = var.region
}

# Billing Budgets API는 사용자 인증(ADC)으로 부르면 quota 프로젝트를 요구한다.
# 예산만 이 별칭 provider로 만들고, quota는 새 프로젝트로 청구한다.
provider "google" {
  alias                 = "billing"
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}
