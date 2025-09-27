"""
Debug Utilities Implementation
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 8.1 exactly
"""

import time
import logging
import functools
from contextlib import contextmanager
from typing import Any, Callable, Optional


# 8.1.1 Logging Configuration
def configure_debug_logging(level: int = logging.DEBUG) -> logging.Logger:
    """
    Configure and return a debug logger with proper formatting.
    
    Args:
        level: Logging level (default: DEBUG)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger('debug_utilities')
    logger.setLevel(level)
    
    # Prevent adding multiple handlers if function is called multiple times
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger


# 8.1.2 Debug Timer Decorator
def debug_timer(logger: Optional[logging.Logger] = None) -> Callable:
    """
    Decorator that logs the execution time of a function.
    
    Args:
        logger: Logger instance to use (optional)
        
    Returns:
        Decorator function
    """
    if logger is None:
        logger = configure_debug_logging()
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()
            logger.debug(f"Starting execution of {func.__name__}")
            
            try:
                result = func(*args, **kwargs)
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                logger.debug(
                    f"Finished execution of {func.__name__} in {execution_time:.4f} seconds"
                )
                return result
            except Exception as e:
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                logger.error(
                    f"Exception in {func.__name__} after {execution_time:.4f} seconds: {e}"
                )
                raise
        
        return wrapper
    return decorator


# 8.1.3 Debug Context Manager
@contextmanager
def debug_context(name: str, logger: Optional[logging.Logger] = None):
    """
    Context manager that logs entry and exit of a code block with timing.
    
    Args:
        name: Name of the context block
        logger: Logger instance to use (optional)
    """
    if logger is None:
        logger = configure_debug_logging()
    
    start_time = time.perf_counter()
    logger.debug(f"Entering context: {name}")
    
    try:
        yield
    except Exception as e:
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        logger.error(
            f"Exception in context '{name}' after {execution_time:.4f} seconds: {e}"
        )
        raise
    else:
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        logger.debug(
            f"Exiting context '{name}' after {execution_time:.4f} seconds"
        )


# 8.1.4 CommandDebugger Class
class CommandDebugger:
    """
    Class for debugging command execution with detailed logging.
    """
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        """
        Initialize CommandDebugger.
        
        Args:
            logger: Logger instance to use (optional)
        """
        self.logger = logger or configure_debug_logging()
        self.execution_stack = []
    
    def log_command_start(self, command: str, args: Optional[tuple] = None) -> None:
        """
        Log the start of a command execution.
        
        Args:
            command: Command name
            args: Command arguments (optional)
        """
        args_str = f" with args {args}" if args else ""
        self.logger.debug(f"Starting command: {command}{args_str}")
        self.execution_stack.append((command, time.perf_counter()))
    
    def log_command_end(self, command: str, result: Any = None) -> None:
        """
        Log the end of a command execution.
        
        Args:
            command: Command name
            result: Command result (optional)
        """
        if not self.execution_stack:
            self.logger.warning("Command end logged without matching start")
            return
        
        expected_command, start_time = self.execution_stack.pop()
        if expected_command != command:
            self.logger.warning(
                f"Command mismatch: expected '{expected_command}', got '{command}'"
            )
        
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        result_str = f" with result: {result}" if result is not None else ""
        self.logger.debug(
            f"Finished command: {command} in {execution_time:.4f} seconds{result_str}"
        )
    
    def log_command_error(self, command: str, error: Exception) -> None:
        """
        Log an error during command execution.
        
        Args:
            command: Command name
            error: Exception that occurred
        """
        if not self.execution_stack:
            self.logger.warning("Command error logged without matching start")
            return
        
        expected_command, start_time = self.execution_stack.pop()
        if expected_command != command:
            self.logger.warning(
                f"Command mismatch: expected '{expected_command}', got '{command}'"
            )
        
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        self.logger.error(
            f"Error in command: {command} after {execution_time:.4f} seconds - {error}"
        )


# Module-level logger instance
debug_logger = configure_debug_logging()

# Export public interface
__all__ = [
    'configure_debug_logging',
    'debug_timer',
    'debug_context',
    'CommandDebugger',
    'debug_logger'
]