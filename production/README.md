# Claude Code Enforcement System - Production Deployment

This document describes how to deploy the Claude Code Enforcement System to a production environment.

## Prerequisites

- Ubuntu 20.04 LTS or newer (other Linux distributions may work with modifications)
- Node.js 16.x or newer
- npm 7.x or newer
- PostgreSQL 12.x or newer
- Systemd
- Root access

## Installation Steps

### 1. Build the Application

From the project root directory:

```bash
./production/build.sh
```

This script will:
- Install dependencies
- Compile TypeScript to JavaScript
- Copy configuration files
- Set appropriate permissions

### 2. Configure Environment Variables

Before installing the service, set the following environment variables:

```bash
# Database password
export DB_PASSWORD="your_database_password"

# JWT secret for authentication
export JWT_SECRET="your_jwt_secret_key"

# Encryption key for sensitive data
export ENCRYPTION_KEY="your_encryption_key"
```

### 3. Run the Installation Script

```bash
sudo ./production/install.sh
```

This script will:
- Create a system user for the service
- Install files to `/opt/claude-code`
- Configure and enable the systemd service
- Start the enforcement service

## Configuration

The production configuration is located at `/opt/claude-code/dist/config/production.json`. Key settings include:

- **server.port**: The port the service listens on (default: 8080)
- **database**: Database connection settings
- **security**: Security-related settings including JWT and encryption
- **logging**: Log file configuration

## Managing the Service

### Start the service
```bash
sudo systemctl start enforcement.service
```

### Stop the service
```bash
sudo systemctl stop enforcement.service
```

### Restart the service
```bash
sudo systemctl restart enforcement.service
```

### Check service status
```bash
sudo systemctl status enforcement.service
```

### View logs
```bash
sudo journalctl -u enforcement.service -f
```

## Security Considerations

1. The service runs under a dedicated system user with minimal privileges
2. File permissions are restricted to necessary access only
3. Sensitive configuration values should be provided via environment variables
4. The service uses systemd security features to limit potential attack surface

## Troubleshooting

### Service fails to start

1. Check service status: `systemctl status enforcement.service`
2. Review logs: `journalctl -u enforcement.service`
3. Verify configuration files exist and are readable
4. Ensure database is accessible with provided credentials

### Database connection issues

1. Verify database is running
2. Check database credentials in configuration
3. Ensure database user has proper permissions
4. Confirm network connectivity to database server

### Performance issues

1. Check system resources (CPU, memory, disk I/O)
2. Review log files for errors or warnings
3. Monitor database performance
4. Adjust rate limiting settings if needed

## Updating the System

To update to a new version:

1. Stop the service: `sudo systemctl stop enforcement.service`
2. Build the new version: `./production/build.sh`
3. Run the installation script: `sudo ./production/install.sh`
4. Start the service: `sudo systemctl start enforcement.service`

## Uninstalling

To completely remove the system:

1. Stop the service: `sudo systemctl stop enforcement.service`
2. Disable the service: `sudo systemctl disable enforcement.service`
3. Remove the service file: `sudo rm /etc/systemd/system/enforcement.service`
4. Reload systemd: `sudo systemctl daemon-reload`
5. Remove files: `sudo rm -rf /opt/claude-code`
6. Remove user: `sudo userdel claude`
