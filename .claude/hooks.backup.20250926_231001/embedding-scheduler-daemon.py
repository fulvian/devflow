#!/usr/bin/env python3
"""
Embedding Scheduler Daemon - Context7 Best Practices
Daemon permanente per background processing automatico embedding coda.
"""

import os
import sys
import time
import signal
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/fulvioventura/devflow/logs/embedding-scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def signal_handler(signum, frame):
    """Handle graceful shutdown"""
    logger.info(f"Received signal {signum}, shutting down...")
    global _global_scheduler
    if _global_scheduler:
        _global_scheduler.stop_scheduler()
    sys.exit(0)

# Global scheduler reference for signal handler
_global_scheduler = None

def main():
    """Main daemon entry point"""
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Import and start scheduler
    hooks_dir = '/Users/fulvioventura/devflow/.claude/hooks'
    if hooks_dir not in sys.path:
        sys.path.insert(0, hooks_dir)

    # Import with file name without extension
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "embedding_background_scheduler",
        os.path.join(hooks_dir, "embedding-background-scheduler.py")
    )
    scheduler_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scheduler_module)
    get_scheduler = scheduler_module.get_scheduler

    global _global_scheduler
    _global_scheduler = get_scheduler()

    # Start scheduler
    if not _global_scheduler.start_scheduler():
        logger.error("Failed to start background scheduler")
        sys.exit(1)

    logger.info("🚀 Embedding scheduler daemon started")

    try:
        # Keep daemon alive
        while True:
            time.sleep(60)  # Check every minute
            if not _global_scheduler.is_running:
                logger.warning("Scheduler stopped unexpectedly, restarting...")
                _global_scheduler.start_scheduler()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    finally:
        _global_scheduler.stop_scheduler()
        logger.info("🛑 Embedding scheduler daemon stopped")

if __name__ == "__main__":
    main()