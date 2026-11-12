# Terraform state 버킷 — main 레이어와 이 레이어 자신이 쓴다 (backend.tf).

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

  # state 버킷이 사라지면 모든 레이어의 기록이 날아간다.
  lifecycle {
    prevent_destroy = true
  }
}
