.PHONY: help sync rebuild clean clean-all logs test ui gateway

# Default target
help:
	@echo "WhatsApp Gateway - Development Commands"
	@echo ""
	@echo "Sync & Deploy:"
	@echo "  make sync          Sync code to Home Assistant local add-on"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make up            Start all services"
	@echo "  make down          Stop all services"
	@echo "  make rebuild       Tear down, rebuild, and start fresh"
	@echo "  make logs          Follow logs from all services"
	@echo "  make logs-gateway  Follow gateway logs only"
	@echo ""
	@echo "Clean:"
	@echo "  make clean         Remove all containers and data volumes"
	@echo "  make clean-all     Full cleanup including images"
	@echo ""
	@echo "Development:"
	@echo "  make ui            Build UI only"
	@echo "  make gateway       Build and run gateway locally"
	@echo "  make test          Run Cypress tests"
	@echo ""
	@echo "Quick workflows:"
	@echo "  make fresh         Clean + rebuild + logs (complete reset)"

# Sync to Home Assistant
sync:
	@echo "🔄 Syncing to Home Assistant..."
	@./sync-to-ha.sh

# Docker Compose - Up
up:
	@echo "🚀 Starting services..."
	docker-compose up -d
	@sleep 2
	@docker-compose ps

# Docker Compose - Down
down:
	@echo "🛑 Stopping services..."
	docker-compose down

# Docker Compose - Rebuild
rebuild: down
	@echo "🔨 Rebuilding services..."
	docker-compose build --no-cache
	@echo "🚀 Starting services..."
	docker-compose up -d
	@sleep 2
	@docker-compose ps
	@echo ""
	@echo "✅ Rebuild complete!"
	@echo "   Gateway UI: http://localhost:8099"
	@echo "   Evolution API: http://localhost:8080"

# Clean - Remove containers and volumes
clean: down
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v
	@echo "✅ Cleanup complete!"

# Clean All - Remove everything including images
clean-all: clean
	@echo "🧹 Removing images..."
	docker-compose down -v --rmi all
	@echo "✅ Full cleanup complete!"

# Logs - Follow all services
logs:
	docker-compose logs -f

# Gateway logs only
logs-gateway:
	docker-compose logs -f gateway

# Build UI
ui:
	@echo "📦 Building UI..."
	cd evolution_api/gateway/ui && npm run build
	@echo "✅ UI build complete!"

# Run gateway locally (for development)
gateway:
	@echo "🚀 Running gateway locally..."
	cd evolution_api/gateway && npm run dev

# Run tests
test:
	@echo "🧪 Running Cypress tests..."
	cd evolution_api/gateway/ui && npm run test:e2e

# Fresh start - complete reset
fresh: clean rebuild
	@echo ""
	@echo "🎉 Fresh environment ready!"
	@echo ""
	@make logs-gateway
