# 방문 분석 — 페이지에 스크립트를 넣지 않고(JS 0) Hosting 요청 로그를 BigQuery로 모은다.
#   Firebase Hosting → Cloud Logging(webrequests) → 로그 싱크 → BigQuery hosting_logs
# 비용 기준: 월 예산 알림 2,000원 안. 무료 한도 밖은 BigQuery 스트리밍 적재(200MB당 $0.01)뿐이라
# 정적 자산(/_astro/**)·favicon 요청을 필터로 빼서 행 수를 페이지 요청만큼으로 줄인다.
#
# Terraform 밖 수동 1회: Firebase 콘솔 → 프로젝트 설정 → 연동 → Cloud Logging → Link → 사이트 daniel-blog
# (Hosting → Logging 연동은 provider 리소스가 없다. infra/README.md 참고)

resource "google_project_service" "analytics" {
  provider = google-beta
  for_each = toset([
    "logging.googleapis.com",
    "bigquery.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_bigquery_dataset" "hosting_logs" {
  provider    = google-beta
  project     = var.project_id
  dataset_id  = "hosting_logs"
  location    = "US"
  description = "Firebase Hosting 요청 로그 (로그 싱크 hosting-to-bq)"

  # 저장량 상한: 파티션은 400일 뒤 지운다
  default_partition_expiration_ms = 400 * 24 * 60 * 60 * 1000

  depends_on = [google_project_service.analytics]
}

resource "google_logging_project_sink" "hosting_to_bq" {
  provider    = google-beta
  project     = var.project_id
  name        = "hosting-to-bq"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.hosting_logs.dataset_id}"

  # 로그 이름은 "webrequests"가 아니라 "firebasehosting.googleapis.com%2Fwebrequests"다.
  # 처음엔 앞쪽을 빼먹어 아무 로그도 안 걸렸다 (2026-11-06 수정). BigQuery 테이블 이름은
  # firebasehosting_googleapis_com_webrequests 가 된다.
  filter = <<-EOT
    resource.type="firebase_domain"
    AND logName="projects/${var.project_id}/logs/firebasehosting.googleapis.com%2Fwebrequests"
    AND NOT httpRequest.requestUrl:"/_astro/"
    AND NOT httpRequest.requestUrl:"/favicon"
  EOT

  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

resource "google_bigquery_dataset_iam_member" "sink_writer" {
  provider   = google-beta
  project    = var.project_id
  dataset_id = google_bigquery_dataset.hosting_logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.hosting_to_bq.writer_identity
}

# 글 조회수(prd/post-views) — 배포 빌드가 이 데이터셋을 읽어 views를 정적 HTML에 박는다.
# 읽기만: 데이터셋 dataViewer + 쿼리 실행(jobUser, 프로젝트 단위밖에 없다)
resource "google_bigquery_dataset_iam_member" "deployer_reader" {
  provider   = google-beta
  project    = var.project_id
  dataset_id = google_bigquery_dataset.hosting_logs.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_bq_job" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/bigquery.jobUser"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}
