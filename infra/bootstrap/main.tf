# 부트스트랩 레이어 — 다른 모든 레이어가 기대는 바닥을 만든다.
#   1. GCP 프로젝트 + 결제 계정 연결
#   2. Terraform state 버킷 (메인 레이어와 이 레이어 자신이 쓴다)
#   3. 월 예산 알림 (0원 유지 장치, DESIGN.md ADR-006)
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

resource "google_project" "blog" {
  project_id      = var.project_id
  name            = var.project_name
  billing_account = var.billing_account_id

  # 실수로 destroy해도 프로젝트는 남는다. 정말 지우려면 이 값을 "DELETE"로 바꾸고 apply 후 destroy.
  deletion_policy = "PREVENT"

  labels = {
    purpose    = "blog"
    managed-by = "terraform"
  }
}

# 이 레이어가 쓰는 API만 켠다. Firebase·IAM 등은 메인 레이어에서 켠다.
resource "google_project_service" "bootstrap" {
  for_each = toset([
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
    "storage.googleapis.com",
  ])

  project            = google_project.blog.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "tfstate" {
  project  = google_project.blog.project_id
  name     = "${var.project_id}-tfstate"
  location = var.region # us-central1: Cloud Storage 상시 무료 한도(5GB) 리전

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  # state를 잘못 덮어써도 이전 버전으로 되돌릴 수 있게 한다.
  versioning {
    enabled = true
  }

  # 이전 버전은 최근 10개만 남긴다 (무료 한도 안에서 무한히 쌓이지 않게).
  lifecycle_rule {
    condition {
      num_newer_versions = 10
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.bootstrap]
}

resource "google_billing_budget" "monthly" {
  provider = google.billing

  billing_account = var.billing_account_id
  display_name    = "${var.project_id} monthly"

  budget_filter {
    projects        = ["projects/${google_project.blog.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "KRW" # 결제 계정 통화와 같아야 한다
      units         = tostring(var.monthly_budget_krw)
    }
  }

  # 예산은 청구를 막지 않는다. 결제 계정 관리자 메일로 알림만 온다.
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  depends_on = [google_project_service.bootstrap]
}
