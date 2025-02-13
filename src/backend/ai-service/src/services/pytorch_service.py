import torch
import numpy as np
import logging
import threading
from typing import Dict, List, Any, Optional
from prometheus_client import Counter, Gauge, Histogram
from functools import wraps
import time

from utils.ml_utils import preprocess_text_data, normalize_features

# Version comments for external dependencies
# torch==2.0.0
# numpy==1.24.0
# prometheus_client==0.16.0

# Global constants with production configurations
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_CACHE_SIZE = 5
BATCH_SIZE = 32
MAX_GPU_MEMORY_PERCENT = 0.9
MODEL_TIMEOUT_SECONDS = 30
INFERENCE_TIMEOUT_SECONDS = 10

# Prometheus metrics
MODEL_LOAD_TIME = Histogram('model_load_seconds', 'Time spent loading models')
INFERENCE_TIME = Histogram('model_inference_seconds', 'Time spent on inference')
GPU_MEMORY_USAGE = Gauge('gpu_memory_usage_bytes', 'Current GPU memory usage')
PREDICTION_ERRORS = Counter('model_prediction_errors', 'Number of prediction errors')
CACHE_HITS = Counter('model_cache_hits', 'Number of model cache hits')

def monitor_resources(func):
    """Decorator for monitoring resource usage and performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            if torch.cuda.is_available():
                GPU_MEMORY_USAGE.set(torch.cuda.memory_allocated())
            return result
        except Exception as e:
            PREDICTION_ERRORS.inc()
            raise
        finally:
            duration = time.time() - start_time
            if func.__name__ == 'predict':
                INFERENCE_TIME.observe(duration)
            elif func.__name__ == 'load_model':
                MODEL_LOAD_TIME.observe(duration)
    return wrapper

def circuit_breaker(max_failures: int = 3, reset_timeout: int = 300):
    """Circuit breaker pattern implementation for model operations"""
    def decorator(func):
        failures = 0
        last_failure_time = 0
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            nonlocal failures, last_failure_time
            current_time = time.time()
            
            if failures >= max_failures and current_time - last_failure_time < reset_timeout:
                raise RuntimeError("Circuit breaker is open")
                
            try:
                result = func(*args, **kwargs)
                failures = 0
                return result
            except Exception as e:
                failures += 1
                last_failure_time = current_time
                raise
        return wrapper
    return decorator

@monitor_resources
def load_model(model_path: str, model_config: Dict, warm_up: bool = True) -> torch.nn.Module:
    """Production-ready model loader with validation and warm-up"""
    try:
        if not model_path or not model_config:
            raise ValueError("Invalid model path or configuration")
            
        # Load model with timeout
        start_time = time.time()
        model = torch.load(model_path, map_location=DEVICE)
        
        if time.time() - start_time > MODEL_TIMEOUT_SECONDS:
            raise TimeoutError("Model loading timeout exceeded")
            
        # Validate model architecture
        if not isinstance(model, torch.nn.Module):
            raise TypeError("Invalid model type")
            
        # Move model to appropriate device
        model.to(DEVICE)
        model.eval()
        
        # Perform warm-up inference if requested
        if warm_up:
            with torch.no_grad():
                dummy_input = torch.randn(1, *model_config.get('input_shape', [1])).to(DEVICE)
                model(dummy_input)
                
        return model
        
    except Exception as e:
        logging.error(f"Error loading model: {str(e)}")
        raise

class PyTorchService:
    """Production-grade PyTorch model service with advanced features"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize service with production configurations"""
        self._model_cache = {}
        self._cache_lock = threading.Lock()
        self._logger = logging.getLogger(__name__)
        self._device = DEVICE
        self._model_performance_metrics = {}
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Validate GPU configuration
        if torch.cuda.is_available():
            torch.cuda.set_per_process_memory_fraction(MAX_GPU_MEMORY_PERCENT)
            self._logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            self._logger.warning("GPU not available, using CPU")
            
        self._logger.info("PyTorchService initialized successfully")

    @monitor_resources
    def predict(self, model_name: str, input_data: Dict[str, Any], 
               prediction_config: Dict[str, Any]) -> Dict[str, Any]:
        """Thread-safe single input prediction with monitoring"""
        try:
            with self._cache_lock:
                # Validate input
                if not input_data or not model_name:
                    raise ValueError("Invalid input data or model name")
                    
                # Get or load model
                if model_name in self._model_cache:
                    model = self._model_cache[model_name]
                    CACHE_HITS.inc()
                else:
                    model = load_model(
                        prediction_config['model_path'],
                        prediction_config['model_config']
                    )
                    self._model_cache[model_name] = model
                
                # Preprocess input
                preprocessed_input = preprocess_text_data(
                    input_data['text'],
                    prediction_config.get('model_type', 'CUSTOM'),
                    batch_mode=False
                )
                
                # Perform inference with timeout
                start_time = time.time()
                with torch.no_grad():
                    output = model(preprocessed_input.to(self._device))
                    
                if time.time() - start_time > INFERENCE_TIMEOUT_SECONDS:
                    raise TimeoutError("Inference timeout exceeded")
                
                # Process output
                result = {
                    'prediction': output.cpu().numpy().tolist(),
                    'model_name': model_name,
                    'inference_time': time.time() - start_time
                }
                
                return result
                
        except Exception as e:
            self._logger.error(f"Prediction error: {str(e)}")
            raise

    @monitor_resources
    def batch_predict(self, model_name: str, batch_data: List[Dict[str, Any]], 
                     batch_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Optimized batch prediction with memory management"""
        try:
            # Validate batch size
            if not batch_data:
                raise ValueError("Empty batch data")
                
            batch_size = min(len(batch_data), BATCH_SIZE)
            results = []
            
            # Process in batches
            for i in range(0, len(batch_data), batch_size):
                batch = batch_data[i:i + batch_size]
                
                # Preprocess batch
                preprocessed_batch = preprocess_text_data(
                    [item['text'] for item in batch],
                    batch_config.get('model_type', 'CUSTOM'),
                    batch_mode=True
                )
                
                # Perform batch inference
                batch_result = self.predict(
                    model_name,
                    {'text': preprocessed_batch},
                    batch_config
                )
                
                results.extend(batch_result['prediction'])
            
            return [{'prediction': pred} for pred in results]
            
        except Exception as e:
            self._logger.error(f"Batch prediction error: {str(e)}")
            raise

    def clear_cache(self) -> None:
        """Thread-safe cache clearing with resource cleanup"""
        try:
            with self._cache_lock:
                self._model_cache.clear()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                self._logger.info("Model cache cleared successfully")
        except Exception as e:
            self._logger.error(f"Cache clearing error: {str(e)}")
            raise