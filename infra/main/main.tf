# 메인 레이어 — 블로그를 띄우는 리소스.
#   지금: Firebase 프로젝트 + Hosting 사이트 (로컬에서 firebase deploy)
#   다음: Workload Identity Federation · 배포 서비스 계정 · 커스텀 도메인

resource "google_project_service" "main" {
  provider = google-beta
  for_each = toset([
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# 기존 GCP 프로젝트에 Firebase를 붙인다. 이때 프로젝트 ID 이름의 기본 사이트(<project_id>.web.app)도 자동으로 생긴다.
resource "google_firebase_project" "blog" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.main]
}

# 공개 주소는 기본 사이트 대신 이 사이트를 쓴다. 프로젝트 ID와 공개 주소를 분리하려는 것.
resource "google_firebase_hosting_site" "blog" {
  provider = google-beta
  project  = google_firebase_project.blog.project
  site_id  = var.site_id
}
