import os
from pathlib import Path
from dotenv import load_dotenv  # python-dotenv v1.0.0

# Base directory configuration
BASE_DIR = Path(__file__).parent.absolute()
MODEL_CACHE_DIR = os.path.join(BASE_DIR, 'models', 'cache')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

class AIServiceConfig:
    """
    Comprehensive configuration management for AI service components including
    model settings, security parameters, and performance optimizations.
    """
    
    def __init__(self):
        """
        Initialize AI service configuration with secure environment variables
        and comprehensive default settings.
        """
        # Load environment variables
        self.load_env_vars()
        
        # Model version configurations
        self.MODEL_VERSIONS = {
            'gpt': {
                'current': 'gpt-4',
                'fallback': 'gpt-3.5-turbo',
                'max_tokens': 2048,
                'temperature': 0.7
            },
            'bert': {
                'current': 'bert-base-uncased',
                'version': '1.0.0',
                'max_sequence_length': 512
            },
            'custom_ml': {
                'version': '2.0.0',
                'architecture': 'transformer',
                'embedding_dim': 768
            }
        }
        
        # Cache settings
        self.CACHE_SETTINGS = {
            'enabled': True,
            'max_size_gb': 10,
            'ttl_hours': 24,
            'cleanup_interval': 3600,
            'compression_enabled': True
        }
        
        # Performance optimization settings
        self.PERFORMANCE_SETTINGS = {
            'batch_size': int(os.getenv('AI_BATCH_SIZE', '32')),
            'learning_rate': float(os.getenv('AI_LEARNING_RATE', '0.001')),
            'num_workers': int(os.getenv('AI_NUM_WORKERS', '4')),
            'gpu_enabled': os.getenv('AI_GPU_ENABLED', 'true').lower() == 'true',
            'mixed_precision': True,
            'optimization_level': 'O2'
        }
        
        # Security configuration
        self.SECURITY_CONFIG = {
            'api_key_rotation_days': 30,
            'max_request_size_mb': 10,
            'rate_limit_requests': 100,
            'rate_limit_window_seconds': 60,
            'encryption_algorithm': 'AES-256-GCM'
        }
        
        # Validate configuration
        self.validate_config()
        
        # Create required directories
        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)

    def load_env_vars(self):
        """
        Securely load and validate all required environment variables.
        Raises ValueError if required variables are missing or invalid.
        """
        if not load_dotenv():
            raise ValueError("Failed to load .env file")
            
        # Required environment variables
        required_vars = [
            'OPENAI_API_KEY',
            'OPENAI_MODEL_VERSION',
            'PYTORCH_MODEL_PATH'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
            
        # Set instance variables with secure handling
        self.OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
        self.OPENAI_MODEL_VERSION = os.getenv('OPENAI_MODEL_VERSION')
        self.MAX_TOKENS = int(os.getenv('MAX_TOKENS', '2048'))
        self.TEMPERATURE = float(os.getenv('TEMPERATURE', '0.7'))
        self.PYTORCH_MODEL_PATH = os.getenv('PYTORCH_MODEL_PATH')
        self.BATCH_SIZE = int(os.getenv('BATCH_SIZE', '32'))
        self.LEARNING_RATE = float(os.getenv('LEARNING_RATE', '0.001'))

    def get_model_path(self, model_name: str, version: str) -> str:
        """
        Retrieve the full path for a specific model with validation and caching.
        
        Args:
            model_name: Name of the model to locate
            version: Version string of the model
            
        Returns:
            str: Validated full path to the model file
            
        Raises:
            ValueError: If model path is invalid or inaccessible
        """
        if not model_name or not version:
            raise ValueError("Model name and version must be provided")
            
        cache_path = os.path.join(MODEL_CACHE_DIR, f"{model_name}-{version}")
        
        if os.path.exists(cache_path):
            return cache_path
            
        model_path = os.path.join(
            BASE_DIR,
            'models',
            model_name,
            version,
            f"{model_name}.pt"
        )
        
        if not os.path.exists(model_path):
            raise ValueError(f"Model not found at path: {model_path}")
            
        return model_path

    def validate_config(self) -> bool:
        """
        Perform comprehensive validation of all configuration settings.
        
        Returns:
            bool: True if configuration is valid, raises ValueError otherwise
        """
        # Validate API key format
        if not self.OPENAI_API_KEY.startswith('sk-'):
            raise ValueError("Invalid OpenAI API key format")
            
        # Validate model paths
        if not os.path.exists(self.PYTORCH_MODEL_PATH):
            raise ValueError(f"PyTorch model path does not exist: {self.PYTORCH_MODEL_PATH}")
            
        # Validate performance settings
        if self.BATCH_SIZE <= 0:
            raise ValueError("Batch size must be positive")
        if not (0 < self.LEARNING_RATE < 1):
            raise ValueError("Learning rate must be between 0 and 1")
            
        # Validate cache settings
        if self.CACHE_SETTINGS['enabled']:
            cache_size = self.CACHE_SETTINGS['max_size_gb']
            if not isinstance(cache_size, (int, float)) or cache_size <= 0:
                raise ValueError("Invalid cache size configuration")
                
        # Validate security settings
        if self.SECURITY_CONFIG['rate_limit_requests'] <= 0:
            raise ValueError("Rate limit must be positive")
            
        return True