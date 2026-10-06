output "project_id" {
  value = google_project.blog.project_id
}

output "project_number" {
  description = "WIF principal 경로 등에서 쓴다"
  value       = google_project.blog.number
}

output "tfstate_bucket" {
  description = "메인 레이어 backend \"gcs\"의 bucket 값"
  value       = google_storage_bucket.tfstate.name
}
