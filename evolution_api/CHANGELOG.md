# Changelog

All notable changes to the WhatsApp Gateway API add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
