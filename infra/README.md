# infra

블로그 호스팅 인프라 (GCP Firebase Hosting). 월 0원(예산 알림 1,000원)을 기준으로 구성한다.

## 레이어

| 디렉터리 | 만드는 것 | state |
|---|---|---|
| `bootstrap/` | GCP 프로젝트 · 결제 계정 연결 · state 버킷 · 월 예산 알림 | 처음엔 로컬 → 버킷 생성 후 GCS(`prefix=bootstrap`)로 이전 |
| `main/` | Firebase 프로젝트 · Hosting 사이트(`daniel-blog`) · 커스텀 도메인 `kyungjin.dev`(`domain.tf`) — 다음: Workload Identity Federation · 배포 서비스 계정 | GCS(`prefix=main`) |

## 규칙

- **`apply`는 사람이 `plan`을 읽고 승인한 뒤에만 실행한다.** AI 도구는 `plan`까지만.
- 콘솔에서 만든 리소스는 `terraform import`로 흡수한다. diff가 뜨면 콘솔이 아니라 코드를 고친다.
- `terraform.tfvars`는 커밋하지 않는다(결제 계정 ID). 예시는 `terraform.tfvars.example`.

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

## 첫 배포 (CI 전, 로컬에서)

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

