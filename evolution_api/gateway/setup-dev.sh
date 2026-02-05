#!/bin/bash
# Local development setup script for WhatsApp Gateway API

set -e

echo "🚀 WhatsApp Gateway API - Local Development Setup"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    cd evolution_api/gateway 2>/dev/null || {
        echo "❌ Please run this script from the gateway directory or repository root"
        exit 1
    }
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install UI dependencies
echo "📦 Installing UI dependencies..."
cd ui
npm install
cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "Available commands:"
echo ""
echo "  1. Start mock backend (for UI development):"
echo "     npm run mock"
echo ""
echo "  2. Start UI dev server (in another terminal):"
echo "     cd ui && npm run dev"
echo ""
echo "  3. Run Cypress tests (in another terminal):"
echo "     cd ui && npm run test:open"
echo ""
echo "  4. Run tests headlessly:"
echo "     cd ui && npm test"
echo ""
echo "Open http://localhost:5173 in your browser to access the UI."
