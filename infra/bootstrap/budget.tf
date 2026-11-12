# 월 예산 알림 — 금액은 variables.tf 의 monthly_budget_krw.

resource "google_billing_budget" "monthly" {
  provider = google.billing

  billing_account = var.billing_account_id
  display_name    = "${var.project_id} monthly"

  budget_filter {
    projects        = ["projects/${google_project.blog.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "KRW" # 결제 계정 통화와 같아야 한다
      units         = tostring(var.monthly_budget_krw)
    }
  }

  # 예산은 청구를 막지 않는다. 결제 계정 관리자 메일로 알림만 온다.
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  depends_on = [google_project_service.bootstrap]

  # 예산 알림이 실수로 지워지면 비용이 새도 알 수 없다. 금액 변경(in-place)은 그대로 된다.
  lifecycle {
    prevent_destroy = true
  }
}
