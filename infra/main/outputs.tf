output "site_id" {
  description = ".firebaserc의 hosting target 값"
  value       = google_firebase_hosting_site.blog.site_id
}

output "default_url" {
  value = google_firebase_hosting_site.blog.default_url
}
