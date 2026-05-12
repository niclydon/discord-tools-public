# Security Policy

## Supported Versions

This repository is published as a public example. Security fixes are accepted for the current `main` branch.

## Reporting a Vulnerability

Do not post Discord bot tokens, webhook URLs, `.env` contents, event logs, private route files, or other secrets in public issues, pull requests, screenshots, or CI logs.

If GitHub private vulnerability reporting is available for this repository, use it. If it is not available, open a minimal public issue that says you need to report a security issue and do not include sensitive details.

Include only the information needed to reproduce the issue safely:

- affected package, command, or endpoint
- expected behavior
- observed behavior
- minimal non-secret configuration
- whether a token, webhook URL, event log, or Discord message body may have been exposed

## If a Secret Is Exposed

Rotate the affected credential immediately before continuing investigation.

- Discord bot token: reset the token in the Discord Developer Portal and update local `.env` files.
- Discord webhook URL: delete and recreate the webhook, then update any local route files or scripts that use it.
- Origin shared secret: generate a new value and update every reverse proxy or client that sends `x-origin-secret`.
- Event logs or route files: remove the exposed copy from the public surface and treat any included Discord IDs or message content as disclosed.

After rotation, remove the exposed value from the current tree and from any public Git history before publishing more changes.
