# state 버킷은 이 레이어가 만든다. 첫 apply는 로컬 state로 했고,
# 버킷이 생긴 뒤 `terraform init -migrate-state`로 여기로 옮겼다 (README 참고).
terraform {
  backend "gcs" {
    bucket = "daniel-blog-1676-tfstate"
    prefix = "bootstrap"
  }
}
