# GCP 프로젝트 자체와, 이 레이어가 쓰는 API.

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

  # Terraform이 이 리소스를 지우거나 다시 만드는 plan을 만들면 에러로 멈춘다 (deletion_policy와 이중 잠금).
  lifecycle {
    prevent_destroy = true
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

  # API 리소스가 코드에서 빠지거나 교체돼도 지워지지 않게 막는다.
  lifecycle {
    prevent_destroy = true
  }
}
