"""
Production Configuration Module

Implements complete production configuration following PIANO_TEST_DEBUG_COMETA_BRAIN.md 
section 9.2 Production Configuration specification.
"""

import os
from typing import Dict, Any, Optional


class ProductionConfig:
    """
    Production configuration class implementing all settings as specified in 
    PIANO_TEST_DEBUG_COMETA_BRAIN.md section 9.2.
    """

    def __init__(self) -> None:
        """Initialize production configuration with all required settings."""
        # Database configuration
        self.DATABASE_URL: str = os.environ.get(
            'DATABASE_URL', 
            'postgresql://user:password@localhost/proddb'
        )
        self.DATABASE_POOL_SIZE: int = int(os.environ.get('DATABASE_POOL_SIZE', '20'))
        self.DATABASE_MAX_OVERFLOW: int = int(os.environ.get('DATABASE_MAX_OVERFLOW', '30'))
        self.DATABASE_POOL_TIMEOUT: int = int(os.environ.get('DATABASE_POOL_TIMEOUT', '30'))
        self.DATABASE_POOL_RECYCLE: int = int(os.environ.get('DATABASE_POOL_RECYCLE', '3600'))
        
        # Performance settings
        self.WORKER_PROCESSES: int = int(os.environ.get('WORKER_PROCESSES', '4'))
        self.WORKER_CONNECTIONS: int = int(os.environ.get('WORKER_CONNECTIONS', '1000'))
        self.WORKER_TIMEOUT: int = int(os.environ.get('WORKER_TIMEOUT', '30'))
        self.MAX_REQUESTS: int = int(os.environ.get('MAX_REQUESTS', '10000'))
        self.MAX_REQUESTS_JITTER: int = int(os.environ.get('MAX_REQUESTS_JITTER', '100'))
        self.KEEPALIVE: int = int(os.environ.get('KEEPALIVE', '5'))
        
        # Security settings
        self.SECRET_KEY: str = os.environ.get('SECRET_KEY', '')
        self.DEBUG: bool = False
        self.ALLOWED_HOSTS: list = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
        self.SSL_ENABLED: bool = os.environ.get('SSL_ENABLED', 'true').lower() == 'true'
        self.SSL_CERT_FILE: Optional[str] = os.environ.get('SSL_CERT_FILE')
        self.SSL_KEY_FILE: Optional[str] = os.environ.get('SSL_KEY_FILE')
        self.CSRF_PROTECTION: bool = True
        self.CONTENT_SECURITY_POLICY: str = (
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        )
        self.HSTS_ENABLED: bool = True
        self.HSTS_MAX_AGE: int = 31536000  # 1 year
        self.HSTS_INCLUDE_SUBDOMAINS: bool = True
        self.HSTS_PRELOAD: bool = True
        
        # Monitoring settings
        self.LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'INFO')
        self.LOG_FORMAT: str = os.environ.get('LOG_FORMAT', 'json')
        self.METRICS_ENABLED: bool = os.environ.get('METRICS_ENABLED', 'true').lower() == 'true'
        self.METRICS_ENDPOINT: str = os.environ.get('METRICS_ENDPOINT', '/metrics')
        self.HEALTH_CHECK_ENDPOINT: str = os.environ.get('HEALTH_CHECK_ENDPOINT', '/health')
        self.TRACING_ENABLED: bool = os.environ.get('TRACING_ENABLED', 'false').lower() == 'true'
        self.TRACING_SERVICE_NAME: str = os.environ.get('TRACING_SERVICE_NAME', 'piano-test-service')
        self.SLOW_QUERY_THRESHOLD: int = int(os.environ.get('SLOW_QUERY_THRESHOLD', '1000'))  # milliseconds
        
        # Feature flags
        self.FEATURE_AUTH_ENABLED: bool = True
        self.FEATURE_CACHE_ENABLED: bool = os.environ.get('FEATURE_CACHE_ENABLED', 'true').lower() == 'true'
        self.FEATURE_RATE_LIMITING: bool = os.environ.get('FEATURE_RATE_LIMITING', 'true').lower() == 'true'
        self.FEATURE_COMPRESSION: bool = os.environ.get('FEATURE_COMPRESSION', 'true').lower() == 'true'
        self.FEATURE_CORS_ENABLED: bool = os.environ.get('FEATURE_CORS_ENABLED', 'false').lower() == 'true'
        self.FEATURE_ASYNC_PROCESSING: bool = os.environ.get('FEATURE_ASYNC_PROCESSING', 'true').lower() == 'true'
        self.FEATURE_WEBHOOKS_ENABLED: bool = os.environ.get('FEATURE_WEBHOOKS_ENABLED', 'true').lower() == 'true'
        
        # Cache settings
        self.CACHE_BACKEND: str = os.environ.get('CACHE_BACKEND', 'redis')
        self.CACHE_URL: str = os.environ.get('CACHE_URL', 'redis://localhost:6379/0')
        self.CACHE_TIMEOUT: int = int(os.environ.get('CACHE_TIMEOUT', '300'))
        self.CACHE_MAX_ENTRIES: int = int(os.environ.get('CACHE_MAX_ENTRIES', '10000'))
        
        # Rate limiting
        self.RATE_LIMIT_WINDOW: int = int(os.environ.get('RATE_LIMIT_WINDOW', '3600'))  # seconds
        self.RATE_LIMIT_REQUESTS: int = int(os.environ.get('RATE_LIMIT_REQUESTS', '1000'))
        self.RATE_LIMIT_STORAGE_URL: str = os.environ.get('RATE_LIMIT_STORAGE_URL', 'redis://localhost:6379/1')
        
        # Compression
        self.COMPRESSION_LEVEL: int = int(os.environ.get('COMPRESSION_LEVEL', '6'))
        self.COMPRESSION_MIME_TYPES: list = os.environ.get(
            'COMPRESSION_MIME_TYPES', 
            'text/html,text/css,application/json'
        ).split(',')
        
        # CORS settings
        self.CORS_ALLOWED_ORIGINS: list = os.environ.get(
            'CORS_ALLOWED_ORIGINS', 
            'https://app.example.com'
        ).split(',')
        self.CORS_ALLOWED_METHODS: list = os.environ.get(
            'CORS_ALLOWED_METHODS', 
            'GET,POST,PUT,DELETE'
        ).split(',')
        self.CORS_ALLOWED_HEADERS: list = os.environ.get(
            'CORS_ALLOWED_HEADERS', 
            'Content-Type,Authorization,X-Requested-With'
        ).split(',')
        
        # Webhooks
        self.WEBHOOK_TIMEOUT: int = int(os.environ.get('WEBHOOK_TIMEOUT', '30'))
        self.WEBHOOK_RETRY_COUNT: int = int(os.environ.get('WEBHOOK_RETRY_COUNT', '3'))
        self.WEBHOOK_RETRY_DELAY: int = int(os.environ.get('WEBHOOK_RETRY_DELAY', '5'))
        
        # Validation
        self._validate_configuration()

    def _validate_configuration(self) -> None:
        """
        Validate critical configuration values.
        
        Raises:
            ValueError: If critical configuration values are missing or invalid.
        """
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set in production environment")
        
        if self.DATABASE_POOL_SIZE <= 0:
            raise ValueError("DATABASE_POOL_SIZE must be greater than 0")
            
        if self.WORKER_PROCESSES <= 0:
            raise ValueError("WORKER_PROCESSES must be greater than 0")

    def get_database_config(self) -> Dict[str, Any]:
        """
        Get database configuration as dictionary.
        
        Returns:
            Dict containing database configuration parameters.
        """
        return {
            'url': self.DATABASE_URL,
            'pool_size': self.DATABASE_POOL_SIZE,
            'max_overflow': self.DATABASE_MAX_OVERFLOW,
            'pool_timeout': self.DATABASE_POOL_TIMEOUT,
            'pool_recycle': self.DATABASE_POOL_RECYCLE
        }

    def get_performance_config(self) -> Dict[str, Any]:
        """
        Get performance configuration as dictionary.
        
        Returns:
            Dict containing performance configuration parameters.
        """
        return {
            'worker_processes': self.WORKER_PROCESSES,
            'worker_connections': self.WORKER_CONNECTIONS,
            'worker_timeout': self.WORKER_TIMEOUT,
            'max_requests': self.MAX_REQUESTS,
            'max_requests_jitter': self.MAX_REQUESTS_JITTER,
            'keepalive': self.KEEPALIVE
        }

    def get_security_config(self) -> Dict[str, Any]:
        """
        Get security configuration as dictionary.
        
        Returns:
            Dict containing security configuration parameters.
        """
        return {
            'secret_key': self.SECRET_KEY,
            'debug': self.DEBUG,
            'allowed_hosts': self.ALLOWED_HOSTS,
            'ssl_enabled': self.SSL_ENABLED,
            'csrf_protection': self.CSRF_PROTECTION,
            'content_security_policy': self.CONTENT_SECURITY_POLICY,
            'hsts_enabled': self.HSTS_ENABLED,
            'hsts_max_age': self.HSTS_MAX_AGE
        }

    def get_monitoring_config(self) -> Dict[str, Any]:
        """
        Get monitoring configuration as dictionary.
        
        Returns:
            Dict containing monitoring configuration parameters.
        """
        return {
            'log_level': self.LOG_LEVEL,
            'log_format': self.LOG_FORMAT,
            'metrics_enabled': self.METRICS_ENABLED,
            'metrics_endpoint': self.METRICS_ENDPOINT,
            'health_check_endpoint': self.HEALTH_CHECK_ENDPOINT,
            'tracing_enabled': self.TRACING_ENABLED,
            'tracing_service_name': self.TRACING_SERVICE_NAME,
            'slow_query_threshold': self.SLOW_QUERY_THRESHOLD
        }

    def get_feature_flags(self) -> Dict[str, bool]:
        """
        Get feature flags as dictionary.
        
        Returns:
            Dict containing feature flag states.
        """
        return {
            'auth_enabled': self.FEATURE_AUTH_ENABLED,
            'cache_enabled': self.FEATURE_CACHE_ENABLED,
            'rate_limiting': self.FEATURE_RATE_LIMITING,
            'compression': self.FEATURE_COMPRESSION,
            'cors_enabled': self.FEATURE_CORS_ENABLED,
            'async_processing': self.FEATURE_ASYNC_PROCESSING,
            'webhooks_enabled': self.FEATURE_WEBHOOKS_ENABLED
        }

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert entire configuration to dictionary.
        
        Returns:
            Dict containing all configuration parameters.
        """
        return {
            'database': self.get_database_config(),
            'performance': self.get_performance_config(),
            'security': self.get_security_config(),
            'monitoring': self.get_monitoring_config(),
            'feature_flags': self.get_feature_flags(),
            'cache_backend': self.CACHE_BACKEND,
            'cache_url': self.CACHE_URL,
            'rate_limit_window': self.RATE_LIMIT_WINDOW,
            'rate_limit_requests': self.RATE_LIMIT_REQUESTS,
            'compression_level': self.COMPRESSION_LEVEL,
            'webhook_timeout': self.WEBHOOK_TIMEOUT
        }


# Global instance for application use
config: ProductionConfig = ProductionConfig()