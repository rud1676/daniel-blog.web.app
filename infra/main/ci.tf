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

# 배포만 할 수 있는 커스텀 역할 (2026-11-12, roles/firebasehosting.admin 대체).
# 기성 Hosting 역할은 Admin/Viewer 둘뿐이고, Admin에는 배포에 필요 없는 sites.create·sites.delete가 들어 있다.
# 배포(버전 생성·업로드·릴리스)는 sites.update 하나에 묶여 있어서, 좁힐 수 있는 건 "사이트 생성·삭제 차단"까지다.
resource "google_project_iam_custom_role" "hosting_deployer" {
  provider    = google-beta
  project     = var.project_id
  role_id     = "blogHostingDeployer"
  title       = "Blog Hosting Deployer"
  description = "firebase deploy --only hosting 에 필요한 권한만 (사이트 생성·삭제 제외)"
  permissions = [
    "firebasehosting.sites.get",
    "firebasehosting.sites.list", # 읽기 전용 — firebase-tools가 사이트를 찾을 때를 대비
    "firebasehosting.sites.update",
    "firebase.projects.get",
    "resourcemanager.projects.get",
  ]

  depends_on = [google_project_service.ci]
}

# Hosting 배포 + firebase-tools가 API 사용 프로젝트를 지정할 때 필요한 권한
resource "google_project_iam_member" "deployer" {
  provider = google-beta
  # 키는 고정 문자열이어야 한다 (커스텀 역할 id는 apply 전엔 알 수 없어서 값으로만 쓴다)
  for_each = {
    hosting      = google_project_iam_custom_role.hosting_deployer.id
    serviceusage = "roles/serviceusage.serviceUsageConsumer"
  }

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# 키 이름을 바꾸면서 serviceUsageConsumer 바인딩이 지웠다 다시 만들어지지 않게 옮긴다.
# (예전 키 "roles/firebasehosting.admin" 바인딩은 옮기지 않는다 — 이번 변경으로 지워지는 게 목적)
moved {
  from = google_project_iam_member.deployer["roles/serviceusage.serviceUsageConsumer"]
  to   = google_project_iam_member.deployer["serviceusage"]
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
