import logging
import threading
from typing import Dict, Optional, Tuple

from config import AIServiceConfig
from models.audience_analyzer import AudienceAnalyzer
from models.campaign_generator import CampaignGenerator
from models.creative_generator import CreativeGenerator
from utils.ml_utils import ModelManager
from services.openai_service import OpenAIService
from services.pytorch_service import PyTorchService

# Version and platform support information
VERSION = "1.0.0"
SUPPORTED_PLATFORMS = ["linkedin", "google"]

# Thread-safe initialization lock
_service_lock = threading.Lock()
_initialized_services = None

def initialize_ai_service(config_override: Optional[Dict] = None, 
                        force_gpu: bool = False) -> Tuple[CampaignGenerator, AudienceAnalyzer, CreativeGenerator]:
    """
    Thread-safe initialization of AI service components with comprehensive resource management.
    
    Args:
        config_override: Optional configuration override dictionary
        force_gpu: Flag to force GPU usage if available
        
    Returns:
        Tuple containing initialized (campaign_generator, audience_analyzer, creative_generator)
        
    Raises:
        ValueError: If configuration validation fails
        RuntimeError: If initialization fails or GPU is forced but unavailable
    """
    global _initialized_services
    
    with _service_lock:
        try:
            # Check if already initialized
            if _initialized_services is not None:
                return _initialized_services
            
            # Initialize configuration
            config = AIServiceConfig()
            if config_override:
                for key, value in config_override.items():
                    setattr(config, key, value)
                    
            # Validate configuration
            config.validate_config()
            
            # Configure logging with structured format
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                handlers=[
                    logging.StreamHandler(),
                    logging.FileHandler(f"{config.LOG_DIR}/ai_service.log")
                ]
            )
            logger = logging.getLogger(__name__)
            
            # Initialize model manager with GPU support
            model_manager = ModelManager(
                cache_size=config.CACHE_SETTINGS['max_size_gb'],
                enable_gpu=force_gpu or config.PERFORMANCE_SETTINGS['gpu_enabled'],
                version_config=config.MODEL_VERSIONS
            )
            
            # Initialize OpenAI service
            openai_service = OpenAIService(config)
            
            # Initialize PyTorch service
            pytorch_service = PyTorchService({
                "model_path": config.PYTORCH_MODEL_PATH,
                "model_config": config.MODEL_VERSIONS['custom_ml'],
                "platform_config": {},
                "cache_enabled": True
            })
            
            # Initialize core components with resource tracking
            campaign_generator = CampaignGenerator(
                model_manager=model_manager,
                openai_service=openai_service,
                config=config.PERFORMANCE_SETTINGS
            )
            
            audience_analyzer = AudienceAnalyzer(
                model_path=config.PYTORCH_MODEL_PATH,
                model_config=config.MODEL_VERSIONS['bert'],
                platform=SUPPORTED_PLATFORMS[0],
                performance_config=config.PERFORMANCE_SETTINGS
            )
            
            creative_generator = CreativeGenerator(
                openai_service=openai_service,
                model_manager=model_manager,
                config=config.PERFORMANCE_SETTINGS
            )
            
            # Store initialized services
            _initialized_services = (campaign_generator, audience_analyzer, creative_generator)
            
            logger.info(
                "AI service initialized successfully",
                extra={
                    "version": VERSION,
                    "gpu_enabled": force_gpu or config.PERFORMANCE_SETTINGS['gpu_enabled'],
                    "supported_platforms": SUPPORTED_PLATFORMS
                }
            )
            
            return _initialized_services
            
        except Exception as e:
            logger.error(f"AI service initialization failed: {str(e)}")
            raise RuntimeError(f"Failed to initialize AI service: {str(e)}")

def cleanup_resources() -> None:
    """
    Safely cleanup all initialized services and resources.
    
    This function ensures proper cleanup of model caches, GPU memory,
    and other system resources in a thread-safe manner.
    """
    global _initialized_services
    
    with _service_lock:
        try:
            if _initialized_services is None:
                return
                
            campaign_generator, audience_analyzer, creative_generator = _initialized_services
            
            # Cleanup individual components
            if hasattr(campaign_generator, 'cleanup_resources'):
                campaign_generator.cleanup_resources()
                
            if hasattr(audience_analyzer, 'cleanup_resources'):
                audience_analyzer.cleanup_resources()
                
            if hasattr(creative_generator, 'cleanup_resources'):
                creative_generator.cleanup_resources()
                
            # Reset initialization state
            _initialized_services = None
            
            logging.getLogger(__name__).info("AI service resources cleaned up successfully")
            
        except Exception as e:
            logging.getLogger(__name__).error(f"Error during resource cleanup: {str(e)}")
            raise

# Export public interface
__all__ = [
    'VERSION',
    'SUPPORTED_PLATFORMS',
    'initialize_ai_service',
    'cleanup_resources',
    'CampaignGenerator',
    'AudienceAnalyzer', 
    'CreativeGenerator'
]