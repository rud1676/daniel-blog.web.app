# 공개 도메인 kyungjin.dev → Hosting 사이트 daniel-blog.
# 도메인 구매와 DNS(Cloudflare)는 사람이 한다. apply 후 아래 output의 레코드를 Cloudflare에 넣는다.
# DNS가 확인돼야 인증서가 나온다 (보통 수 분 ~ 24시간). .dev는 HTTPS만 되므로 그 전엔 접속되지 않는다.

variable "custom_domain" {
  description = "공개 도메인. astro.config.mjs의 site와 같아야 한다."
  type        = string
  default     = "kyungjin.dev"
}

resource "google_firebase_hosting_custom_domain" "blog" {
  provider = google-beta

  project       = var.project_id
  site_id       = google_firebase_hosting_site.blog.site_id
  custom_domain = var.custom_domain

  # apply가 DNS 전파를 기다리며 멈추지 않게 한다. 상태는 output과 Firebase 콘솔에서 본다.
  wait_dns_verification = false
}

output "custom_domain_dns_updates" {
  description = "Cloudflare DNS에 넣을 레코드(desired). Cloudflare에서는 프록시를 끄고(DNS only) 넣는다."
  value       = google_firebase_hosting_custom_domain.blog.required_dns_updates
}

output "custom_domain_states" {
  description = "ownership_state / host_state 가 ACTIVE·HOST_ACTIVE 가 되면 연결 완료"
  value = {
    ownership = google_firebase_hosting_custom_domain.blog.ownership_state
    host      = google_firebase_hosting_custom_domain.blog.host_state
  }
}
