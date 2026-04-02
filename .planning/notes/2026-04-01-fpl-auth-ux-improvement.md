---
date: "2026-04-01 12:00"
promoted: false
---

FPL auth UX improvement: replace manual bearer token extraction with credential-based login (email+password → FPL login endpoint → auto session). Current token-paste flow is too clunky. Check existing login route handlers to see how much work is needed.
