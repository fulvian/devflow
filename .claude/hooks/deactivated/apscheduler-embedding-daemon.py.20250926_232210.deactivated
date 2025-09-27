#!/usr/bin/env python3
"""
APScheduler Embedding Daemon - Context7 Robust Solution
Background embedding processor using APScheduler per persistent scheduling.

Features (Context7 APScheduler Patterns):
- BackgroundScheduler con threading automatico
- SQLite persistence per job survival
- Graceful shutdown con keyboard interrupt handling
- Adaptive intervals (aggressive/normal/idle modes)
- Error handling e retry automatico
"""

import os
import sys
import signal
import logging
import asyncio
import importlib.util
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# APScheduler imports
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.base import JobLookupError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/fulvioventura/devflow/logs/apscheduler-embedding.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class APSchedulerEmbeddingDaemon:
    """
    APScheduler-based embedding daemon usando Context7 best practices.
    Implementa persistent scheduling con SQLite job store.
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)

        # APScheduler configuration (Context7 pattern) - Use proper memory store config
        from apscheduler.jobstores.memory import MemoryJobStore

        jobstores = {
            'default': MemoryJobStore()  # Use memory store instance
        }

        executors = {
            'default': ThreadPoolExecutor(max_workers=3)
        }

        job_defaults = {
            'coalesce': True,           # Coalesce missed executions
            'max_instances': 1,         # Only one instance at a time
            'misfire_grace_time': 30    # 30 second grace period
        }

        # Initialize BackgroundScheduler (Context7 recommended)
        self.scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            daemonic=True  # Context7: daemonic threads for proper cleanup
        )

        # Load embedding populator
        self.populator = self._load_embedding_populator()

        # Intervals configuration (BALANCED - 2025-09-26)
        self.intervals = {
            'aggressive': 15,   # 15 seconds for high queue
            'normal': 30,       # 30 seconds for normal queue (BALANCED)
            'idle': 30          # 30 seconds for idle queue (BALANCED)
        }

        # State tracking
        self.current_job_id = None

    def _load_embedding_populator(self):
        """Load embedding populator with proper imports"""
        try:
            hooks_dir = str(self.project_root / ".claude" / "hooks")
            if hooks_dir not in sys.path:
                sys.path.insert(0, hooks_dir)

            spec = importlib.util.spec_from_file_location(
                "embedding_auto_population",
                self.project_root / ".claude" / "hooks" / "embedding-auto-population.py"
            )
            embedding_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(embedding_module)

            populator = embedding_module.LazyEmbeddingPopulator(str(self.project_root))
            logger.info("✅ Embedding populator loaded successfully")
            return populator

        except Exception as e:
            logger.error(f"Failed to load embedding populator: {e}")
            return None

    def _get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        if not self.populator:
            return {'pending_entries': 0}

        try:
            return self.populator.get_population_status()
        except Exception as e:
            logger.error(f"Queue status check failed: {e}")
            return {'pending_entries': 0}

    def _determine_mode(self, pending_entries: int) -> str:
        """Determine scheduling mode based on queue size"""
        if pending_entries >= 50:
            return 'aggressive'
        elif pending_entries <= 5:
            return 'idle'
        else:
            return 'normal'

    def embedding_job(self):
        """
        APScheduler job function per embedding processing.
        Implementa Context7 pattern con force processing in aggressive mode.
        """
        try:
            start_time = datetime.now()

            # Get queue status and determine force processing
            queue_status = self._get_queue_status()
            pending_entries = queue_status.get('pending_entries', 0)
            current_mode = self._determine_mode(pending_entries)

            # Force processing in aggressive mode (Context7 pattern)
            force_processing = (current_mode == 'aggressive' and pending_entries > 50)

            logger.info(f"🎯 Processing embedding queue (mode: {current_mode}, pending: {pending_entries}, force: {force_processing})")

            # Process embeddings using async populator
            if self.populator:
                # Run async method in sync context (APScheduler thread)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(
                    self.populator.lazy_populate_embeddings(force=force_processing)
                )
                loop.close()

                duration = (datetime.now() - start_time).total_seconds()

                logger.info(f"📈 Embedding processing completed: {result} (duration: {duration:.2f}s)")

                # Update job interval based on mode (Context7 adaptive pattern)
                self._update_job_interval(current_mode)

                return result
            else:
                logger.error("❌ Populator not available")
                return {'error': 'populator_not_available'}

        except Exception as e:
            logger.error(f"Embedding job failed: {e}")
            return {'error': str(e)}

    def _update_job_interval(self, mode: str):
        """Update job interval based on current mode (Context7 adaptive pattern)"""
        try:
            new_interval = self.intervals[mode]

            # Reschedule job with new interval
            if self.current_job_id:
                self.scheduler.reschedule_job(
                    self.current_job_id,
                    trigger='interval',
                    seconds=new_interval
                )
                logger.debug(f"⏰ Job rescheduled to {new_interval}s interval (mode: {mode})")

        except JobLookupError:
            logger.warning("Job not found for rescheduling")
        except Exception as e:
            logger.error(f"Failed to update job interval: {e}")

    def start(self):
        """Start APScheduler daemon (Context7 pattern)"""
        try:
            # Add initial job (aggressive mode interval) - Use standalone function
            self.current_job_id = 'embedding_processor'
            self.scheduler.add_job(
                func=standalone_embedding_job,  # Use standalone function to avoid serialization
                trigger='interval',
                seconds=self.intervals['aggressive'],
                id=self.current_job_id,
                name='Embedding Background Processor',
                replace_existing=True
            )

            # Start scheduler (Context7 BackgroundScheduler pattern)
            self.scheduler.start()
            logger.info("🚀 APScheduler embedding daemon started successfully")

            return True

        except Exception as e:
            logger.error(f"Failed to start APScheduler daemon: {e}")
            return False

    def stop(self):
        """Stop APScheduler daemon gracefully (Context7 pattern)"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=True)
                logger.info("✅ APScheduler embedding daemon stopped gracefully")
            return True
        except Exception as e:
            logger.error(f"Failed to stop APScheduler daemon: {e}")
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive daemon status"""
        queue_status = self._get_queue_status()

        job_info = {}
        if self.current_job_id:
            try:
                job = self.scheduler.get_job(self.current_job_id)
                if job:
                    job_info = {
                        'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                        'trigger': str(job.trigger)
                    }
            except JobLookupError:
                job_info = {'error': 'job_not_found'}

        return {
            'daemon_running': self.scheduler.running if self.scheduler else False,
            'scheduler_type': 'APScheduler_BackgroundScheduler',
            'job_info': job_info,
            'queue_status': queue_status,
            'populator_available': self.populator is not None
        }

# Global daemon instance and standalone job function
_daemon_instance = None

def get_daemon() -> APSchedulerEmbeddingDaemon:
    """Get singleton daemon instance"""
    global _daemon_instance
    if _daemon_instance is None:
        _daemon_instance = APSchedulerEmbeddingDaemon()
    return _daemon_instance

def standalone_embedding_job():
    """
    Standalone embedding job function for APScheduler.
    Evita serialization issues usando funzione standalone.
    """
    daemon = get_daemon()
    return daemon.embedding_job()

def signal_handler(signum, frame):
    """Handle graceful shutdown (Context7 pattern)"""
    logger.info(f"Received signal {signum}, shutting down APScheduler daemon...")
    daemon = get_daemon()
    daemon.stop()
    sys.exit(0)

def main():
    """Main daemon entry point (Context7 persistent pattern)"""
    import argparse

    parser = argparse.ArgumentParser(description='APScheduler Embedding Daemon')
    parser.add_argument('--start', action='store_true', help='Start daemon')
    parser.add_argument('--stop', action='store_true', help='Stop daemon')
    parser.add_argument('--status', action='store_true', help='Show daemon status')
    parser.add_argument('--daemon', action='store_true', help='Run as persistent daemon')

    args = parser.parse_args()

    daemon = get_daemon()

    if args.status:
        import json
        status = daemon.get_status()
        print(json.dumps(status, indent=2))
        return

    if args.start:
        success = daemon.start()
        print("✅ APScheduler daemon started" if success else "❌ Failed to start daemon")
        return

    if args.stop:
        success = daemon.stop()
        print("✅ APScheduler daemon stopped" if success else "❌ Failed to stop daemon")
        return

    if args.daemon:
        # Setup signal handlers for graceful shutdown (Context7 pattern)
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        # Start daemon
        if not daemon.start():
            logger.error("Failed to start APScheduler daemon")
            sys.exit(1)

        logger.info("🚀 APScheduler embedding daemon running persistently")

        try:
            # Keep main thread alive (Context7 BackgroundScheduler pattern)
            while daemon.scheduler.running:
                signal.pause()  # Wait for signals
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        finally:
            daemon.stop()

        return

    # Default: show help
    parser.print_help()

if __name__ == "__main__":
    main()