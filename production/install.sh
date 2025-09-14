#!/bin/bash

# Automated installation script for Claude Code Enforcement System
# This script installs the system as a systemd service

set -e

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
echo_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

echo_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo_error "This script must be run as root. Please use sudo."
  exit 1
fi

# Check for required tools
REQUIRED_TOOLS=("node" "npm" "tsc" "systemctl")
for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &> /dev/null; then
    echo_error "$tool is required but not installed. Please install it first."
    exit 1
  fi
done

# Create system user
echo_info "Creating system user 'claude'..."
if ! id "claude" &>/dev/null; then
  useradd --system --create-home --shell /bin/false claude
  echo_info "Created user 'claude'"
else
  echo_warn "User 'claude' already exists"
fi

# Create installation directory
echo_info "Creating installation directory..."
mkdir -p /opt/claude-code
chown claude:claude /opt/claude-code

# Copy files
echo_info "Copying application files..."
cp -r dist/* /opt/claude-code/

# Set permissions
echo_info "Setting file permissions..."
chown -R claude:claude /opt/claude-code
chmod +x /opt/claude-code/src/index.js

# Install systemd service
echo_info "Installing systemd service..."
cp production/systemd/enforcement.service /etc/systemd/system/
systemctl daemon-reload

# Enable service
echo_info "Enabling enforcement service..."
systemctl enable enforcement.service

# Create data and log directories
echo_info "Creating data and log directories..."
mkdir -p /opt/claude-code/dist/data
mkdir -p /opt/claude-code/dist/logs
chown -R claude:claude /opt/claude-code/dist/data
chown -R claude:claude /opt/claude-code/dist/logs

# Set environment variables
echo_info "Setting environment variables..."
cat > /etc/systemd/system/enforcement.service.d/override.conf << EOF
[Service]
Environment=NODE_ENV=production
Environment=CONFIG_PATH=/opt/claude-code/dist/config/production.json
EOF

systemctl daemon-reload

# Start service
echo_info "Starting enforcement service..."
systemctl start enforcement.service

# Check service status
echo_info "Checking service status..."
systemctl status enforcement.service --no-pager || true

# Final instructions
echo_info "Installation completed successfully!"
echo_info "The Claude Code Enforcement System is now running."
echo_info "To check the service status, run: systemctl status enforcement.service"
echo_info "To view logs, run: journalctl -u enforcement.service -f"
