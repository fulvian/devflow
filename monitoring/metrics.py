"""
Monitoring Setup Implementation
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 8.2 exactly
"""

import time
import functools
from typing import Any, Callable, Optional
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client import CollectorRegistry, REGISTRY
from prometheus_client.multiprocess import MultiProcessCollector


class MetricsCollector:
    """
    Centralized metrics collector implementing all required Prometheus metrics
    as specified in section 8.2 of PIANO_TEST_DEBUG_COMETA_BRAIN.md
    """
    
    def __init__(self, registry: Optional[CollectorRegistry] = None):
        """
        Initialize all required metrics
        
        Args:
            registry: Prometheus registry to use, defaults to global REGISTRY
        """
        self.registry = registry or REGISTRY
        
        # Initialize Counter metrics
        self.requests_total = Counter(
            'cometa_requests_total',
            'Total number of requests',
            ['method', 'endpoint', 'status'],
            registry=self.registry
        )
        
        self.errors_total = Counter(
            'cometa_errors_total',
            'Total number of errors',
            ['error_type', 'operation'],
            registry=self.registry
        )
        
        # Initialize Histogram metrics
        self.request_duration_seconds = Histogram(
            'cometa_request_duration_seconds',
            'Request duration in seconds',
            ['method', 'endpoint'],
            registry=self.registry
        )
        
        self.operation_duration_seconds = Histogram(
            'cometa_operation_duration_seconds',
            'Operation duration in seconds',
            ['operation_name'],
            registry=self.registry
        )
        
        # Initialize Gauge metrics
        self.active_requests = Gauge(
            'cometa_active_requests',
            'Number of currently active requests',
            registry=self.registry
        )
        
        self.system_health = Gauge(
            'cometa_system_health',
            'System health status (0=unhealthy, 1=healthy)',
            registry=self.registry
        )
        
        self.connected_clients = Gauge(
            'cometa_connected_clients',
            'Number of currently connected clients',
            registry=self.registry
        )
        
        # Set default health status
        self.system_health.set(1)
    
    def increment_requests(self, method: str, endpoint: str, status: str) -> None:
        """
        Increment the total requests counter
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            status: HTTP status code
        """
        self.requests_total.labels(method=method, endpoint=endpoint, status=status).inc()
    
    def increment_errors(self, error_type: str, operation: str) -> None:
        """
        Increment the total errors counter
        
        Args:
            error_type: Type of error
            operation: Operation where error occurred
        """
        self.errors_total.labels(error_type=error_type, operation=operation).inc()
    
    def set_active_requests(self, count: float) -> None:
        """
        Set the current number of active requests
        
        Args:
            count: Number of active requests
        """
        self.active_requests.set(count)
    
    def set_system_health(self, status: float) -> None:
        """
        Set the system health status
        
        Args:
            status: Health status (0=unhealthy, 1=healthy)
        """
        self.system_health.set(status)
    
    def set_connected_clients(self, count: float) -> None:
        """
        Set the number of connected clients
        
        Args:
            count: Number of connected clients
        """
        self.connected_clients.set(count)
    
    def time_request(self, method: str, endpoint: str) -> Callable:
        """
        Decorator to time request duration
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            
        Returns:
            Decorator function
        """
        return self.request_duration_seconds.labels(
            method=method, 
            endpoint=endpoint
        ).time()
    
    def time_operation(self, operation_name: str) -> Callable:
        """
        Decorator to time operation duration
        
        Args:
            operation_name: Name of the operation
            
        Returns:
            Decorator function
        """
        return self.operation_duration_seconds.labels(
            operation_name=operation_name
        ).time()


def time_operation(operation_name: str, metrics_collector: MetricsCollector) -> Callable:
    """
    Decorator to time any operation using the metrics collector
    
    Args:
        operation_name: Name of the operation to time
        metrics_collector: MetricsCollector instance
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with metrics_collector.operation_duration_seconds.labels(
                operation_name=operation_name
            ).time():
                return func(*args, **kwargs)
        return wrapper
    return decorator


# Global metrics collector instance
metrics_collector: Optional[MetricsCollector] = None


def initialize_metrics(multiprocess: bool = False) -> MetricsCollector:
    """
    Initialize the global metrics collector
    
    Args:
        multiprocess: Whether to use multiprocess collector
        
    Returns:
        Initialized MetricsCollector instance
    """
    global metrics_collector
    
    registry = CollectorRegistry()
    if multiprocess:
        MultiProcessCollector(registry)
    
    metrics_collector = MetricsCollector(registry)
    return metrics_collector


def get_metrics_collector() -> MetricsCollector:
    """
    Get the global metrics collector instance
    
    Returns:
        MetricsCollector instance
        
    Raises:
        RuntimeError: If metrics collector hasn't been initialized
    """
    if metrics_collector is None:
        raise RuntimeError("Metrics collector not initialized. Call initialize_metrics() first.")
    return metrics_collector


def generate_metrics() -> bytes:
    """
    Generate the latest metrics in Prometheus format
    
    Returns:
        Metrics data in Prometheus text format
    """
    collector = get_metrics_collector()
    return generate_latest(collector.registry)


def get_content_type() -> str:
    """
    Get the content type for Prometheus metrics
    
    Returns:
        Content type string
    """
    return CONTENT_TYPE_LATEST


# Example usage functions
def example_usage() -> None:
    """
    Example of how to use the metrics collector
    """
    # Initialize metrics
    collector = initialize_metrics()
    
    # Increment counters
    collector.increment_requests("GET", "/api/users", "200")
    collector.increment_errors("ValidationError", "user_registration")
    
    # Set gauges
    collector.set_active_requests(5)
    collector.set_connected_clients(10)
    
    # Use decorators
    @time_operation("database_query", collector)
    def example_db_operation() -> str:
        time.sleep(0.1)  # Simulate work
        return "result"
    
    example_db_operation()


if __name__ == "__main__":
    example_usage()