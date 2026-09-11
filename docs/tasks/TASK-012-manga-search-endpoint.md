# TASK-012 — Manga search API endpoint

Expose `GET /api/manga/search?q=...` through the normalized Taiju contract. Validate bounded query parameters, delegate to the MangaDex provider, and never expose its DTOs or errors directly.
