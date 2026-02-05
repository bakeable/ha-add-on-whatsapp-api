# Changelog

All notable changes to the WhatsApp Gateway API add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.18] - 2025-02-06

### Added

- **Multi-event rule triggers**: Rules can now subscribe to any combination of 20 Evolution API event types (e.g., MESSAGES_UPSERT, CALL, CONNECTION_UPDATE, GROUP_PARTICIPANTS_UPDATE, etc.)
- **Text match modes**: New `mode` field for text matching — `contains` (normalised, case-insensitive), `starts_with`, and `regex`
- **Text normalisation**: `contains` and `starts_with` modes automatically lowercase, trim, and collapse whitespace before comparison
- **Sender phone number filter**: Match rules by sender phone numbers (auto-extracts from WhatsApp JIDs)
- **Sender JID filter**: Match rules by exact sender JIDs (e.g., `31612345678@s.whatsapp.net`) — both `sender.ids` and `sender.numbers` supported simultaneously with AND logic
- **Live rule test execution**: New Test & Debug page allows simulating events and executing matching rules for real (HA services called, WhatsApp replies sent) with detailed results showing evaluated rules, executed actions, timing, and verbose execution logs
- **Event log**: All incoming Evolution API webhook events are logged to `wa_event_log` table with event type, chat, sender, and summary
- **Events tab in Logs page**: Browse all received Evolution API events with event-type filtering
- **Auto webhook registration**: Gateway registers itself with Evolution API on startup to receive ALL event types
- **Unit tests**: Added comprehensive tests for `normaliseText()`, `extractPhoneNumber()`, and rule matching logic
- **`event_type` column** on `wa_rule_fire` table to track which event triggered each rule execution

### Changed

- **Rules schema**: Text filter changed from `contains[]`/`starts_with`/`regex` to unified `{ mode, patterns[] }` structure
- **Sender filter**: Support both `sender.ids` (exact JID match) and `sender.numbers` (phone number extraction) — AND logic when both specified
- **Verbose logging**: Rule engine now logs step-by-step matching, action execution with timing, and detailed results
- **Webhook events**: `run.sh` now configures Evolution API to forward all 20 event types (was only 3)
- **Rules UI Guided Builder**: Rebuilt with event selector, text match mode dropdown, sender number input, and live YAML preview
- **Rule fires table**: Now shows the triggering event type

## [1.1.17] - 2025-02-05

### Added

- **Custom Integration**: New `custom_components/whatsapp_gateway/` integration that registers proper HA services
  - `whatsapp_gateway.send_message` - Send text messages
  - `whatsapp_gateway.send_media` - Send images, videos, documents, audio
  - Services appear in automation editor action dropdown
- **Rules Page Enhancements**:
  - Auto-generate rule ID from rule name (e.g., "Motion Alert" → "motion_alert")
  - Multi-select chat filter with search functionality
  - HA service parameter display (shows required/optional fields for services)

### Changed

- Improved Rules guided builder UI with better service action configuration

## [1.1.16] - 2025-02-05

### Fixed

- Empty page on initial load - now auto-redirects to appropriate page based on connection status
- "Create Rule" button 404 error - fixed to use client-side navigation
- `reply_whatsapp` action now properly logged in gateway logs

## [1.1.15] - 2025-02-05

### Fixed

- Prisma database migrations now run correctly on startup
- Fixed "Table 'Instance' doesn't exist" error by properly running migrations
- Copies mysql-migrations folder and sets DATABASE_URL before migrate deploy

## [1.1.6] - 2026-02-05

### Fixed

- UI API calls now work correctly with Home Assistant ingress proxy
- Ingress path detection ensures API endpoints resolve to the gateway instead of Home Assistant domain

## [1.1.5] - 2026-02-05

### Changed

- Simplified database configuration to always use MariaDB/MySQL (removed PostgreSQL option)
- Prisma Client now regenerates with MySQL schema on startup to prevent schema mismatch errors

### Fixed

- Prisma schema compatibility - Evolution API no longer attempts to use PostgreSQL schema when MySQL is configured
- Database provider is now hardcoded to `mysql` for consistency

## [1.1.4] - 2026-02-05

### Changed

- Removed `database_provider` option from configuration (MariaDB/MySQL is now the only supported database)
- Updated translations to reflect MariaDB-only support
- Simplified database configuration UI

## [1.1.3] - 2026-02-05

### Added

- `DATABASE_ENABLED` environment variable to Evolution API
- All Evolution API database save flags (`DATABASE_SAVE_DATA_*`) for complete data persistence

### Fixed

- Database not being used by Evolution API due to missing `DATABASE_ENABLED=true`
- Unbound variable errors in run.sh script with `set +u`
- Safe variable expansion for optional configuration values

## [1.1.2] - 2026-02-05

### Fixed

- Bashio installation now includes all required library files
- Fixed missing `/usr/lib/bashio/` directory structure

## [1.1.1] - 2026-02-05

### Changed

- Overrode Evolution API Docker image entrypoint to use custom run.sh script
- Removed hardcoded entrypoint that was calling base image's deploy_database.sh

### Fixed

- Add-on startup failures due to base image's incompatible entrypoint script

## [1.1.0] - 2026-02-05

### Added

- Automatic API key generation and persistence to `/data/.evolution_api_key`
- API key is now auto-generated on first startup if not exists
- API key persists across restarts

### Changed

- Removed `api_key` from user-configurable options
- API key is now managed automatically by the add-on

### Security

- API key no longer exposed in add-on configuration UI
- API key stored securely in persistent storage

## [1.0.2] - 2026-02-05

### Fixed

- Chat sync cleanup no longer deletes all records
- Fixed timestamp comparison in sync logic (MySQL DATETIME vs Unix timestamp)

## [1.0.1] - 2026-02-05

### Changed

- Migrated from SQLite (better-sqlite3) to MariaDB (mysql2)
- Gateway database now uses mysql2 package instead of better-sqlite3

### Fixed

- Node.js v24 compatibility - removed native module compilation requirement
- Installation no longer fails due to better-sqlite3 build errors

## [1.0.0] - 2026-02-04

### Added

- Initial release
- WhatsApp integration via Evolution API v2.3.7
- `notify.whatsapp` service auto-registration via Home Assistant Discovery API
- Web UI for WhatsApp connection management (QR code scanning)
- Chat management and sync with Home Assistant
- Rule engine for message-to-automation triggers
- Gateway API with endpoints for WhatsApp operations
- Health check endpoint for watchdog monitoring
- MariaDB database support for persistent storage
- Multi-architecture support (aarch64, amd64, armv7)

### Features

- **Send messages** from Home Assistant automations
- **Receive messages** and trigger automations via webhook rules
- **Persistent WhatsApp sessions** that survive restarts
- **QR code authentication** via web UI
- **Contact and group chat sync**
- **Message history** and logging
- **Configurable instance settings** (auto-read, reject calls, etc.)

[1.1.6]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/bakeable/homeassistant-whatsapp-gateway/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/bakeable/homeassistant-whatsapp-gateway/releases/tag/v1.0.0
