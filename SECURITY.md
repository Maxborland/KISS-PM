# Security Policy

Security issues should be reported privately.

## Supported versions

KISS PM is in early founder-beta development. The `master` branch is the only currently supported public branch.

## Reporting a vulnerability

Please do not disclose vulnerabilities in public issues, discussions, comments, or pull requests.

Preferred reporting path:

1. Use GitHub private vulnerability reporting / Security Advisories for this repository when available.
2. Include a minimal description, affected area, reproduction steps, and expected impact.
3. Avoid including real secrets, private customer data, production credentials, or third-party confidential information.

If private GitHub reporting is not available, contact the repository maintainer through their public GitHub profile and ask for a private security-reporting channel. Do not post exploit details publicly while requesting contact.

## Scope

In scope:

- authentication and session handling;
- authorization/RBAC bypasses;
- unsafe project mutation flows;
- audit integrity problems;
- API input validation issues;
- dependency or supply-chain vulnerabilities;
- SSRF, path traversal, injection, XSS, CSRF, and similar application security issues.

Out of scope:

- denial-of-service testing against services you do not own;
- social engineering;
- physical attacks;
- reports based only on outdated dependency versions without an exploitable path;
- issues requiring access to private systems or data without authorization.

## Safe testing expectations

Only test systems and repositories you own or are explicitly authorized to assess. Keep reproduction steps minimal and avoid destructive tests.
