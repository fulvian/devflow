#!/usr/bin/env python3
"""
Embedding Background Scheduler - Context7 Best Practices (Huey Pattern)
Automatic queue processing per embedding vettoriali con scheduling intelligente.

Features Context7-Compliant:
- Periodic task scheduling (cron-like)
- Background queue processing senza intervento manuale
- Rate limiting awareness con token management
- Graceful error handling e retries
- Performance monitoring e adaptive intervals
"""

import os
import sys
import json
import time
import asyncio
import logging
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SchedulerConfig:
    """Configuration per background scheduler (Context7-compliant)"""
    # Scheduling Intervals (Huey-inspired pattern)
    check_interval_seconds: int = 120  # 2 minuti - check coda ogni 2 min
    aggressive_interval_seconds: int = 30  # 30 secondi - modalità aggressiva
    idle_interval_seconds: int = 120  # 2 minuti - modalità idle

    # Queue Management
    min_queue_size_for_processing: int = 10  # Min entries in coda per attivazione
    max_consecutive_runs: int = 5  # Max run consecutivi prima di pausa
    cooldown_after_max_runs_minutes: int = 30  # Pausa dopo max runs

    # Performance Thresholds
    high_activity_threshold: int = 50  # Entries per attivare modalità aggressiva
    low_activity_threshold: int = 5   # Entries per modalità idle
    rate_limit_respect_factor: float = 0.8  # Usa 80% dei token disponibili

    # Error Handling
    max_retries: int = 3
    retry_delay_seconds: int = 60
    error_cooldown_minutes: int = 10

class EmbeddingBackgroundScheduler:
    """
    Background Scheduler per processamento automatico embedding queue.
    Implementa pattern Huey per task scheduling + Context7 best practices.
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)
        self.config = SchedulerConfig()

        # State files
        self.scheduler_state_file = self.project_root / ".devflow" / "embedding-scheduler-state.json"
        self.scheduler_state_file.parent.mkdir(parents=True, exist_ok=True)

        # Scheduler state
        self.scheduler_state = self._load_scheduler_state()
        self.is_running = False
        self.scheduler_thread = None

        # Performance tracking
        self.consecutive_runs = 0
        self.last_cooldown = None
        self.error_count = 0
        self.last_error = None

        # Import embedding populator with correct module path
        hooks_dir = str(self.project_root / ".claude" / "hooks")
        if hooks_dir not in sys.path:
            sys.path.insert(0, hooks_dir)

        try:
            # Import directly from file
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "embedding_auto_population",
                self.project_root / ".claude" / "hooks" / "embedding-auto-population.py"
            )
            embedding_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(embedding_module)

            self.populator = embedding_module.LazyEmbeddingPopulator(str(self.project_root))
            logger.info("✅ Background scheduler initialized with embedding populator")
        except Exception as e:
            logger.error(f"Failed to initialize embedding populator: {e}")
            self.populator = None

    def _load_scheduler_state(self) -> Dict[str, Any]:
        """Load scheduler state per tracking persistente"""
        try:
            if self.scheduler_state_file.exists():
                with open(self.scheduler_state_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Scheduler state loading failed: {e}")

        return {
            'last_run': None,
            'total_scheduled_runs': 0,
            'total_embeddings_processed': 0,
            'avg_processing_time_seconds': 0,
            'current_mode': 'normal',  # normal, aggressive, idle
            'scheduler_enabled': True,
            'performance_history': []
        }

    def _save_scheduler_state(self):
        """Save scheduler state"""
        try:
            with open(self.scheduler_state_file, 'w') as f:
                json.dump(self.scheduler_state, f, indent=2)
        except Exception as e:
            logger.error(f"Scheduler state saving failed: {e}")

    def _get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status from populator"""
        if not self.populator:
            return {'pending_entries': 0, 'rate_limiter_tokens': 0}

        try:
            return self.populator.get_population_status()
        except Exception as e:
            logger.error(f"Queue status check failed: {e}")
            return {'pending_entries': 0, 'rate_limiter_tokens': 0}

    def _determine_scheduling_mode(self, queue_status: Dict[str, Any]) -> str:
        """
        Determine optimal scheduling mode basato su queue status (Context7 pattern).
        """
        pending_entries = queue_status.get('pending_entries', 0)

        if pending_entries >= self.config.high_activity_threshold:
            return 'aggressive'
        elif pending_entries <= self.config.low_activity_threshold:
            return 'idle'
        else:
            return 'normal'

    def _get_next_interval(self, mode: str) -> int:
        """Get interval basato su scheduling mode"""
        intervals = {
            'aggressive': self.config.aggressive_interval_seconds,
            'normal': self.config.check_interval_seconds,
            'idle': self.config.idle_interval_seconds
        }
        return intervals.get(mode, self.config.check_interval_seconds)

    def _should_process_queue(self, queue_status: Dict[str, Any]) -> tuple[bool, str]:
        """
        Determine se processare la coda basato su intelligent criteria.
        Returns: (should_process, reason)
        """
        pending_entries = queue_status.get('pending_entries', 0)
        rate_limiter_tokens = queue_status.get('rate_limiter_tokens', 0)

        # Check minimum queue size
        if pending_entries < self.config.min_queue_size_for_processing:
            return False, f"queue_too_small ({pending_entries} < {self.config.min_queue_size_for_processing})"

        # Check rate limiting tokens
        min_tokens_needed = max(1, int(self.config.rate_limit_respect_factor *
                                      queue_status.get('rate_limit_capacity', 120)))
        if rate_limiter_tokens < min_tokens_needed:
            return False, f"insufficient_tokens ({rate_limiter_tokens} < {min_tokens_needed})"

        # Check consecutive runs cooldown
        if (self.consecutive_runs >= self.config.max_consecutive_runs and
            self.last_cooldown and
            datetime.now() - self.last_cooldown < timedelta(minutes=self.config.cooldown_after_max_runs_minutes)):
            return False, "consecutive_runs_cooldown"

        # Check error cooldown
        if (self.last_error and
            datetime.now() - self.last_error < timedelta(minutes=self.config.error_cooldown_minutes)):
            return False, "error_cooldown"

        return True, "ready_for_processing"

    async def _process_embedding_queue(self) -> Dict[str, Any]:
        """Process embedding queue using populator"""
        if not self.populator:
            return {'error': 'populator_not_available'}

        try:
            start_time = datetime.now()

            # Run lazy population (force in aggressive mode with high queue)
            queue_status = self._get_queue_status()
            current_mode = self._determine_scheduling_mode(queue_status)
            force_processing = (current_mode == 'aggressive' and
                              queue_status.get('pending_entries', 0) > self.config.high_activity_threshold)
            result = await self.populator.lazy_populate_embeddings(force=force_processing)

            # Update performance tracking
            duration = (datetime.now() - start_time).total_seconds()
            self.scheduler_state['total_scheduled_runs'] += 1
            self.scheduler_state['total_embeddings_processed'] += result.get('updated', 0)

            # Update average processing time
            current_avg = self.scheduler_state.get('avg_processing_time_seconds', 0)
            if current_avg == 0:
                self.scheduler_state['avg_processing_time_seconds'] = duration
            else:
                # Exponential moving average
                self.scheduler_state['avg_processing_time_seconds'] = (
                    current_avg * 0.7 + duration * 0.3
                )

            # Track performance history (keep last 10 runs)
            perf_entry = {
                'timestamp': start_time.isoformat(),
                'duration_seconds': duration,
                'embeddings_processed': result.get('updated', 0),
                'errors': result.get('errors', 0)
            }

            history = self.scheduler_state.get('performance_history', [])
            history.append(perf_entry)
            if len(history) > 10:
                history = history[-10:]
            self.scheduler_state['performance_history'] = history

            # Reset error count on success
            if result.get('errors', 0) == 0:
                self.error_count = 0
                self.last_error = None

            logger.info(f"📈 Scheduled embedding processing completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Embedding queue processing failed: {e}")
            self.error_count += 1
            self.last_error = datetime.now()
            return {'error': str(e)}

    def _background_scheduler_loop(self):
        """
        Main background scheduler loop (Huey-inspired pattern).
        Runs in separate thread per non-blocking operation.
        """
        logger.info("🚀 Background embedding scheduler started")

        while self.is_running:
            try:
                # Get current queue status
                queue_status = self._get_queue_status()

                # Determine scheduling mode
                current_mode = self._determine_scheduling_mode(queue_status)
                if current_mode != self.scheduler_state.get('current_mode'):
                    logger.info(f"📊 Scheduler mode changed: {self.scheduler_state.get('current_mode')} → {current_mode}")
                    self.scheduler_state['current_mode'] = current_mode

                # Check if should process
                should_process, reason = self._should_process_queue(queue_status)

                if should_process:
                    logger.info(f"🎯 Processing embedding queue (mode: {current_mode}, pending: {queue_status.get('pending_entries', 0)})")

                    # Run processing directly (sync)
                    try:
                        start_time = datetime.now()

                        # Call populator directly without async
                        queue_status = self._get_queue_status()
                        current_mode = self._determine_scheduling_mode(queue_status)
                        force_processing = (current_mode == 'aggressive' and
                                          queue_status.get('pending_entries', 0) > self.config.high_activity_threshold)

                        # Direct sync call to populator
                        if self.populator:
                            import asyncio
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            result = loop.run_until_complete(
                                self.populator.lazy_populate_embeddings(force=force_processing)
                            )
                            loop.close()
                        else:
                            result = {'error': 'populator_not_available'}

                        # Update performance tracking
                        duration = (datetime.now() - start_time).total_seconds()
                        self.scheduler_state['total_scheduled_runs'] += 1
                        self.scheduler_state['total_embeddings_processed'] += result.get('updated', 0)

                        # Update average processing time
                        current_avg = self.scheduler_state.get('avg_processing_time_seconds', 0)
                        if current_avg == 0:
                            self.scheduler_state['avg_processing_time_seconds'] = duration
                        else:
                            # Exponential moving average
                            self.scheduler_state['avg_processing_time_seconds'] = (
                                current_avg * 0.7 + duration * 0.3
                            )

                        # Track performance history (keep last 10 runs)
                        perf_entry = {
                            'timestamp': start_time.isoformat(),
                            'duration_seconds': duration,
                            'embeddings_processed': result.get('updated', 0),
                            'errors': result.get('errors', 0)
                        }

                        history = self.scheduler_state.get('performance_history', [])
                        history.append(perf_entry)
                        if len(history) > 10:
                            history = history[-10:]
                        self.scheduler_state['performance_history'] = history

                        # Reset error count on success
                        if result.get('errors', 0) == 0:
                            self.error_count = 0
                            self.last_error = None

                        # Track consecutive runs
                        if result.get('updated', 0) > 0:
                            self.consecutive_runs += 1
                        else:
                            self.consecutive_runs = 0

                        # Check for cooldown trigger
                        if self.consecutive_runs >= self.config.max_consecutive_runs:
                            self.last_cooldown = datetime.now()
                            self.consecutive_runs = 0
                            logger.info(f"⏸️ Triggering cooldown after {self.config.max_consecutive_runs} consecutive runs")

                        logger.info(f"📈 Scheduled embedding processing completed: {result}")

                    except Exception as e:
                        logger.error(f"Processing failed: {e}")
                        self.error_count += 1
                        self.last_error = datetime.now()

                else:
                    logger.debug(f"⏭️ Skipping queue processing: {reason}")

                # Update state
                self.scheduler_state['last_run'] = datetime.now().isoformat()
                self._save_scheduler_state()

                # Wait for next interval
                next_interval = self._get_next_interval(current_mode)
                logger.debug(f"⏰ Next check in {next_interval}s (mode: {current_mode})")

                # Sleep with interrupt check
                sleep_start = datetime.now()
                while (datetime.now() - sleep_start).total_seconds() < next_interval:
                    if not self.is_running:
                        break
                    time.sleep(1)  # Simple sleep instead of threading.Event

            except Exception as e:
                logger.error(f"Scheduler loop error: {e}")
                # Sleep before retry
                threading.Event().wait(self.config.retry_delay_seconds)

        logger.info("🛑 Background embedding scheduler stopped")

    def start_scheduler(self) -> bool:
        """Start background scheduler"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return False

        if not self.populator:
            logger.error("Cannot start scheduler: populator not available")
            return False

        self.is_running = True
        self.scheduler_thread = threading.Thread(target=self._background_scheduler_loop, daemon=True)
        self.scheduler_thread.start()

        logger.info("✅ Background embedding scheduler started successfully")
        return True

    def stop_scheduler(self) -> bool:
        """Stop background scheduler"""
        if not self.is_running:
            logger.warning("Scheduler is not running")
            return False

        self.is_running = False

        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=30)  # Wait max 30 seconds

        logger.info("✅ Background embedding scheduler stopped")
        return True

    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get comprehensive scheduler status"""
        queue_status = self._get_queue_status()

        return {
            'scheduler_running': self.is_running,
            'scheduler_enabled': self.scheduler_state.get('scheduler_enabled', True),
            'current_mode': self.scheduler_state.get('current_mode', 'normal'),
            'total_scheduled_runs': self.scheduler_state.get('total_scheduled_runs', 0),
            'total_embeddings_processed': self.scheduler_state.get('total_embeddings_processed', 0),
            'avg_processing_time_seconds': round(self.scheduler_state.get('avg_processing_time_seconds', 0), 2),
            'consecutive_runs': self.consecutive_runs,
            'error_count': self.error_count,
            'last_run': self.scheduler_state.get('last_run'),
            'last_error': self.last_error.isoformat() if self.last_error else None,
            'queue_status': queue_status,
            'next_check_interval_seconds': self._get_next_interval(self.scheduler_state.get('current_mode', 'normal')),
            'performance_history': self.scheduler_state.get('performance_history', [])
        }

# Global scheduler instance
_scheduler_instance = None

def get_scheduler() -> EmbeddingBackgroundScheduler:
    """Get singleton scheduler instance"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = EmbeddingBackgroundScheduler()
    return _scheduler_instance

def main():
    """Entry point per background scheduler management"""
    import argparse

    parser = argparse.ArgumentParser(description='Embedding Background Scheduler')
    parser.add_argument('--start', action='store_true', help='Start background scheduler')
    parser.add_argument('--stop', action='store_true', help='Stop background scheduler')
    parser.add_argument('--status', action='store_true', help='Show scheduler status')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon (blocking)')

    args = parser.parse_args()

    scheduler = get_scheduler()

    if args.status:
        status = scheduler.get_scheduler_status()
        print(json.dumps(status, indent=2))
        return

    if args.start:
        success = scheduler.start_scheduler()
        if success:
            print("✅ Background scheduler started")
        else:
            print("❌ Failed to start scheduler")
        return

    if args.stop:
        success = scheduler.stop_scheduler()
        if success:
            print("✅ Background scheduler stopped")
        else:
            print("❌ Failed to stop scheduler")
        return

    if args.daemon:
        scheduler.start_scheduler()
        try:
            # Keep main thread alive
            while scheduler.is_running:
                threading.Event().wait(60)
        except KeyboardInterrupt:
            print("\n🛑 Received interrupt signal")
            scheduler.stop_scheduler()
        return

    # Default: show help
    parser.print_help()

if __name__ == "__main__":
    main()