# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in **SeenBase Analytics**, please report it privately.

- Do **not** open a public issue.
- Use **GitHub Private Vulnerability Reporting** directly on the repository to submit your report confidentially to maintainers.

Please include:
- A description of the vulnerability and potential impact.
- Step-by-step instructions or proof-of-concept to reproduce the issue.

## Privacy & Pseudonymization Architecture

SeenBase Analytics is designed privacy-first:

1. **No Raw IP Storage**: Visitor IP addresses are immediately hashed using `HMAC-SHA-256(IP_HASH_KEY, YYYY-MM-DD + "\0" + IP)`. The raw visitor IP address is never stored in D1 database tables or logs.
2. **Day-Scoped Visitor Hashes**: The hash key includes the current UTC date string (`YYYY-MM-DD`). On the next UTC day, the same IP address produces a different hash, preventing long-term cross-day visitor profiling.
3. **No Tracking Cookies**: SeenBase Analytics uses zero client-side tracking cookies.
