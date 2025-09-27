# Smart Session Retry System for Claude Code

## Overview

This system automatically detects Claude Code session limits and schedules automatic resume when the limit resets.

## How It Works

1. **Limit Detection**: The system monitors Claude Code output for limit messages like "5-hour limit reached ∙ resets 3am"
2. **Parsing**: Extracts the exact reset time (3am)
3. **Scheduling**: Programs a resume for 1 minute after reset time (3:01am)
4. **Execution**: Automatically resumes Claude Code at the scheduled time

## Components

- **Session Retry Service**: Core service that manages scheduling and resume
- **Limit Detector Hook**: Intercepts Claude Code limit messages
- **Resume Scripts**: Handles actual Claude Code session resumption

## Usage

### Automatic Integration

When you start DevFlow services with:
```bash
./devflow-start.sh
```

The Smart Session Retry system is automatically started in the background.

### Using Claude Code with Limit Detection

Instead of running `claude-code` directly, use:
```bash
./scripts/claude-code-with-limit-detection.sh
```

This wrapper will automatically detect limit messages and notify the retry system.

### Manual Limit Notification

You can also manually notify the system of a limit:
```bash
node src/core/session/notify-limit.js "5-hour limit reached ∙ resets 3am"
```

## Configuration

The system uses default settings:
- Buffer time: 1 minute after reset
- Retry attempts: 3
- Retry interval: 10 minutes

Configuration can be adjusted by modifying the AutoResumeManager settings.

## Logs

Check logs in:
- `logs/session-retry.log` - Main session retry logs
- `logs/session-retry-test.log` - Test logs