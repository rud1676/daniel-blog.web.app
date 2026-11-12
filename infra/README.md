# infra

블로그 호스팅 인프라 (GCP Firebase Hosting). 월 0원에 가깝게(예산 알림 2,000원) 구성한다.

## 파일 구조

두 기준으로 나눈다.

- **레이어(폴더)**: 먼저 깔아야 하는 바닥(`bootstrap/`)과 그 위에 올리는 것(`main/`). state도 레이어별로 따로 둔다.
- **기능(파일)**: 레이어 안에서는 하는 일 하나에 파일 하나. "배포 권한이 과하지 않나?"면 `ci.tf`만, "봇은 어디서 거르지?"면 `analytics.tf`만 열면 된다. 기능을 붙일 땐 파일을 하나 추가한다.

```text
infra/
├── bootstrap/                 # 레이어 1 — 바닥. 거의 안 바꾼다
│   ├── project.tf             # GCP 프로젝트 + 결제 계정 연결 + 이 레이어가 쓰는 API
│   ├── state.tf               # Terraform state 버킷 (버전 10개 보관)
│   ├── budget.tf              # 월 예산 알림 (50%·100%·예상 100%, 메일)
│   ├── backend.tf             # 이 레이어 state 위치 (자기가 만든 버킷)
│   ├── versions.tf            # Terraform·provider 설정
│   ├── variables.tf           # 프로젝트 ID·결제 계정·리전·예산 금액
│   └── outputs.tf             # main이 쓰는 값 (프로젝트 번호, 버킷 이름)
└── main/                      # 레이어 2 — 블로그를 띄우는 것. 기능 붙일 때마다 바뀐다
    ├── main.tf                # Firebase 프로젝트 + Hosting 사이트 daniel-blog
    ├── domain.tf              # 커스텀 도메인 kyungjin.dev (DNS는 Cloudflare, 사람)
    ├── ci.tf                  # GitHub Actions 배포: WIF + blog-deployer + 배포 전용 역할
    ├── analytics.tf           # 방문 분석: Hosting 로그 → BigQuery
    ├── versions.tf            # provider 설정 + state 위치 (prefix=main)
    ├── variables.tf
    └── outputs.tf
```

레포의 다른 곳과의 연결:

| 파일 | 인프라와의 관계 |
|---|---|
| `firebase.json` | Hosting 배포 설정 (`dist` 업로드, 캐시 헤더). target `blog` → 사이트 `daniel-blog` (`.firebaserc`) |
| `.github/workflows/deploy.yml` | `live-*` 태그 · 매일 06:00 · 수동 실행 → `ci.tf`의 WIF로 인증 → 빌드(BigQuery에서 조회수) → 배포 |

## 레이어

| 디렉터리 | 만드는 것 | state |
|---|---|---|
| `bootstrap/` | GCP 프로젝트 · 결제 계정 연결 · state 버킷 · 월 예산 알림 | 처음엔 로컬 → 버킷 생성 후 GCS(`prefix=bootstrap`)로 이전 |
| `main/` | Firebase 프로젝트 · Hosting 사이트(`daniel-blog`) · 커스텀 도메인 `kyungjin.dev` · GitHub Actions 배포 권한 · 방문 분석 | GCS(`prefix=main`) |

## 규칙

- **`apply`는 사람이 `plan`을 읽고 승인한 뒤에만 실행한다.** AI 도구는 `plan`까지만.
- 콘솔에서 만든 리소스는 `terraform import`로 흡수한다. diff가 뜨면 콘솔이 아니라 코드를 고친다.
- `terraform.tfvars`는 커밋하지 않는다(결제 계정 ID). 예시는 `terraform.tfvars.example`.
- **사람 관리자(owner) 권한은 코드에 넣지 않는다.** Terraform을 돌리는 계정이 곧 owner라 코드로 관리하면 자기 잠금 위험만 생긴다. 코드로 관리하는 건 기계 권한(`main/ci.tf`, `main/analytics.tf`)이다.
- **지워지면 안 되는 bootstrap 리소스**(프로젝트·API·state 버킷·예산)에는 `lifecycle { prevent_destroy = true }`를 건다. 정말 지워야 하면 그 줄을 먼저 지우고 plan을 다시 본다. 콘솔에서 직접 지우는 건 막지 못한다.

## bootstrap 순서

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # 값 채우기
terraform init
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan               # 승인 후

# state를 GCS로 옮기기
#   backend.tf 주석을 풀고 bucket 값을 output tfstate_bucket으로 채운 뒤
terraform init -migrate-state
```

## 첫 배포 (CI 전, 로컬에서 — 지금은 쓰지 않는다)

```bash
cd infra/main
terraform init
terraform plan -out=main.tfplan
terraform apply main.tfplan                    # 승인 후

cd ../..
npm run build
npx firebase deploy --only hosting:blog        # gcloud ADC로 인증
```

## 커스텀 도메인 (`domain.tf`)

DNS는 Cloudflare에 있다. Terraform은 Firebase 쪽 연결만 만든다.

1. 사람: Cloudflare에서 `kyungjin.dev` 구매 (DNS 존이 자동으로 생긴다)
2. `terraform plan` → 사람 승인 → `apply`
3. `terraform output custom_domain_dns_updates` 의 `desired` 레코드를 Cloudflare DNS에 **DNS only(회색 구름)** 로 추가
4. `terraform output custom_domain_states` 가 `OWNERSHIP_ACTIVE` · `HOST_ACTIVE` 가 될 때까지 기다린다 (인증서까지 최대 24시간)

## 기본 주소 daniel-blog.web.app

Hosting 사이트마다 `<site>.web.app`·`<site>.firebaseapp.com` 주소가 붙고, 사이트가 살아 있는 한 끌 수 없다. `kyungjin.dev`도 같은 사이트 `daniel-blog`에 붙어 있어서 이 주소만 따로 닫을 수 없고, `firebase.json`의 redirect는 경로 기준이라 "이 호스트로 오면"이라는 조건을 걸 수 없다.

그래서 **브라우저에서 리다이렉트한다**: `src/components/ThemeScript.astro`(모든 페이지 `<head>` 맨 앞 인라인 스크립트) 첫 줄이 호스트가 `*.web.app`·`*.firebaseapp.com`이면 같은 경로의 `https://kyungjin.dev`로 `location.replace` 한다. 서버 301이 아니라 JS를 끈 방문자·크롤러에겐 그대로 보이지만, 모든 페이지 canonical이 `https://kyungjin.dev/…`라 검색엔진은 `kyungjin.dev`로 모은다. 검색엔진 등록도 `kyungjin.dev`로만 한다 (2026-11-12).

## GitHub Actions 배포 (`ci.tf`)

서비스 계정 키를 만들지 않고 Workload Identity Federation으로 GitHub OIDC 토큰을 GCP 자격으로 바꾼다.

| 리소스 | 내용 |
|---|---|
| WIF pool `github` · provider `github-oidc` | 이 저장소(repository_id 고정)의 `refs/tags/live-*`(배포) · `refs/heads/main`(cron·수동 재배포) 토큰만 받는다 |
| 커스텀 역할 `blogHostingDeployer` | `firebasehosting.sites.get·list·update` · `firebase.projects.get` · `resourcemanager.projects.get` — 배포만. 기성 `roles/firebasehosting.admin`에서 사이트 생성·삭제를 뺐다 (기성 Hosting 역할은 Admin·Viewer 둘뿐) |
| 서비스 계정 `blog-deployer` | 위 커스텀 역할 · `roles/serviceusage.serviceUsageConsumer` (BigQuery 읽기는 `analytics.tf`) |
| `roles/iam.workloadIdentityUser` | 위 저장소 principalSet → `blog-deployer` |

1. `terraform -chdir=infra/main plan -out=ci.tfplan` → 사람이 읽고 승인 → `terraform -chdir=infra/main apply ci.tfplan`
2. GitHub 저장소 Settings → Secrets and variables → Actions
   - 변수 `GCP_WIF_PROVIDER` = `terraform output -raw wif_provider`, `GCP_DEPLOYER` = `terraform output -raw deployer_email`
   - 시크릿 `DENY_WORDS` = 홈 git log에 나가면 안 되는 단어(쉼표 구분). 레포·로그에 적지 않는다
3. `deploy.yml`이 들어간 main 커밋에 `live-*` 태그를 push → Actions에서 배포·확인 단계까지 초록인지 본다

## 방문 분석 (`analytics.tf`)

페이지에 스크립트를 넣지 않고 Hosting 요청 로그를 BigQuery로 모은다(JS 0). 정적 자산(`/_astro/**`)·favicon 요청은 싱크 필터로 뺀다.

| 리소스 | 내용 |
|---|---|
| `google_bigquery_dataset.hosting_logs` | US, 파티션 400일 뒤 삭제(저장량 상한) |
| `google_logging_project_sink.hosting_to_bq` | `firebase_domain` · `firebasehosting.googleapis.com%2Fwebrequests` 로그 → 위 데이터셋(파티션 테이블) |
| `google_bigquery_dataset_iam_member.sink_writer` | 싱크 writer identity에 `roles/bigquery.dataEditor` |
| `deployer_reader` · `deployer_bq_job` | `blog-deployer`에 데이터셋 읽기 + 쿼리 실행 — 빌드 때 글 조회수를 읽는다 |

비용: Logging 수집 월 50GiB·싱크 라우팅·BigQuery 저장 10GiB·조회 1TiB는 무료 한도 안. **BigQuery 스트리밍 적재만 200MB당 $0.01**(월 수 원~수십 원) — 월 예산 알림 2,000원 안.

1. `plan` → 사람 승인 → `apply`
2. **수동 1회**: Firebase 콘솔 → 프로젝트 설정 → 연동 → **Cloud Logging** → Link → 사이트 `daniel-blog` (Terraform 리소스 없음). 연결 후 30분 안에 로그가 쌓이기 시작한다
3. 확인 쿼리:

```sql
SELECT DATE(timestamp) AS day, httpRequest.requestUrl AS url, COUNT(*) AS views
FROM `daniel-blog-1676.hosting_logs.firebasehosting_googleapis_com_webrequests`
WHERE httpRequest.status = 200 AND NOT REGEXP_CONTAINS(httpRequest.userAgent, r'(?i)bot|crawler|spider')
GROUP BY day, url ORDER BY day DESC, views DESC
```

