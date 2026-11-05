# GitHub Actions → Firebase Hosting 배포 권한 (Workload Identity Federation).
# 서비스 계정 키(JSON)를 만들지 않는다. GitHub OIDC 토큰을 잠깐 쓰는 GCP 자격으로 바꾼다.
#
# 누가 배포할 수 있나 (attribute_condition):
#   - 이 저장소(repository_id로 고정 — 이름을 바꿔도 다른 저장소가 같은 이름을 가져가도 안전)
#   - live-* 태그 push(배포) 또는 main(매일 cron·수동 재배포 — 둘 다 기본 브랜치 ref로 돈다)
# 워크플로가 한 번 더 "태그 커밋이 main 위에 있나"를 검사한다 (.github/workflows/deploy.yml).

locals {
  # github.com/rud1676/daniel-blog.web.app 의 저장소 ID (gh api repos/rud1676/daniel-blog.web.app --jq .id)
  github_repo_id = "1407313222"
}

resource "google_project_service" "ci" {
  provider = google-beta
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_iam_workload_identity_pool" "github" {
  provider                  = google-beta
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.ci]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  provider                           = google-beta
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"          = "assertion.sub"
    "attribute.repository"    = "assertion.repository"
    "attribute.repository_id" = "assertion.repository_id"
    "attribute.ref"           = "assertion.ref"
  }

  attribute_condition = "assertion.repository_id == '${local.github_repo_id}' && (assertion.ref.startsWith('refs/tags/live-') || assertion.ref == 'refs/heads/main')"
}

resource "google_service_account" "deployer" {
  provider     = google-beta
  project      = var.project_id
  account_id   = "blog-deployer"
  display_name = "GitHub Actions — Firebase Hosting 배포"

  depends_on = [google_project_service.ci]
}

# Hosting 배포 + firebase-tools가 API 사용 프로젝트를 지정할 때 필요한 권한
resource "google_project_iam_member" "deployer" {
  provider = google-beta
  for_each = toset([
    "roles/firebasehosting.admin",
    "roles/serviceusage.serviceUsageConsumer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# 이 저장소에서 온 토큰만 위 서비스 계정을 쓸 수 있다
resource "google_service_account_iam_member" "deployer_wif" {
  provider           = google-beta
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id/${local.github_repo_id}"
}

output "wif_provider" {
  description = "deploy.yml 의 workload_identity_provider (GitHub 저장소 변수 GCP_WIF_PROVIDER)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_email" {
  description = "deploy.yml 의 service_account (GitHub 저장소 변수 GCP_DEPLOYER)"
  value       = google_service_account.deployer.email
}
