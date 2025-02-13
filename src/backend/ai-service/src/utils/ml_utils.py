import torch
import numpy as np
from typing import Union, List, Dict, Optional
from functools import wraps
import scipy.sparse
from transformers import AutoTokenizer, AutoModel  # transformers v4.30.0
from sklearn.preprocessing import RobustScaler, StandardScaler, MinMaxScaler  # scikit-learn v1.3.0
import logging
from config import AIServiceConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global constants
MODEL_TYPES = ["BERT", "GPT", "CUSTOM"]
CACHE_TTL = 3600  # Cache time-to-live in seconds
MAX_BATCH_SIZE = 32
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def validate_input(func):
    """Decorator for input validation with detailed error handling."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            if not args and not kwargs:
                raise ValueError("No input parameters provided")
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Input validation failed in {func.__name__}: {str(e)}")
            raise
    return wrapper

def handle_sparse_matrix(func):
    """Decorator for handling sparse matrix operations."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if args and scipy.sparse.issparse(args[0]):
            dense_input = args[0].toarray()
            new_args = (dense_input,) + args[1:]
            return func(*new_args, **kwargs)
        return func(*args, **kwargs)
    return wrapper

class ModelManager:
    """Enhanced model manager with GPU support and memory optimization."""
    
    def __init__(self, 
                 cache_size: int = AIServiceConfig().CACHE_SETTINGS['max_size_gb'],
                 enable_gpu: bool = True,
                 version_config: Optional[Dict] = None):
        """
        Initialize the model manager with advanced configuration.
        
        Args:
            cache_size: Maximum cache size in GB
            enable_gpu: Flag to enable GPU acceleration
            version_config: Model version configuration dictionary
        """
        self._model_cache = {}
        self._last_accessed = {}
        self._model_versions = version_config or AIServiceConfig().MODEL_VERSIONS
        self._memory_usage = {}
        self._device = DEVICE if enable_gpu else torch.device('cpu')
        self._cache_size = cache_size * 1024 * 1024 * 1024  # Convert to bytes
        
        logger.info(f"ModelManager initialized with device: {self._device}")

    def get_model(self, 
                 model_name: str, 
                 model_type: str,
                 force_reload: bool = False) -> torch.nn.Module:
        """
        Retrieve a model with advanced caching and version validation.
        
        Args:
            model_name: Name of the model to retrieve
            model_type: Type of model (BERT, GPT, CUSTOM)
            force_reload: Force model reload from disk
            
        Returns:
            Loaded PyTorch model
        """
        if model_type not in MODEL_TYPES:
            raise ValueError(f"Invalid model type. Must be one of {MODEL_TYPES}")
            
        cache_key = f"{model_name}_{model_type}"
        
        if not force_reload and cache_key in self._model_cache:
            self._last_accessed[cache_key] = torch.cuda.current_timestamp()
            return self._model_cache[cache_key]
            
        try:
            if model_type == "BERT":
                model = AutoModel.from_pretrained(model_name)
            elif model_type == "GPT":
                model = AutoModel.from_pretrained(model_name)
            else:
                model = torch.load(AIServiceConfig().get_model_path(model_name, 
                                 self._model_versions['custom_ml']['version']))
                
            model.to(self._device)
            self._update_cache(cache_key, model)
            return model
            
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {str(e)}")
            raise

    def clear_cache(self, 
                   force_clear: bool = False,
                   memory_threshold: float = 0.9) -> Dict:
        """
        Clear model cache with memory optimization.
        
        Args:
            force_clear: Force clear all cached models
            memory_threshold: Memory usage threshold for cleanup
            
        Returns:
            Dictionary with cleanup statistics
        """
        if force_clear:
            self._model_cache.clear()
            self._last_accessed.clear()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            return {"cleared_models": len(self._model_cache), "memory_freed": "all"}
            
        if torch.cuda.is_available():
            current_memory = torch.cuda.memory_allocated() / torch.cuda.max_memory_allocated()
            if current_memory > memory_threshold:
                models_to_remove = sorted(
                    self._last_accessed.items(),
                    key=lambda x: x[1]
                )[:len(self._model_cache)//2]
                
                for model_key, _ in models_to_remove:
                    del self._model_cache[model_key]
                    del self._last_accessed[model_key]
                
                torch.cuda.empty_cache()
                return {
                    "cleared_models": len(models_to_remove),
                    "memory_freed": f"{current_memory:.2f}%"
                }
        
        return {"cleared_models": 0, "memory_freed": "0%"}

    def _update_cache(self, cache_key: str, model: torch.nn.Module):
        """Update model cache with memory management."""
        if torch.cuda.is_available():
            current_memory = torch.cuda.memory_allocated()
            while (current_memory > self._cache_size and self._model_cache):
                # Remove least recently used model
                lru_key = min(self._last_accessed.items(), key=lambda x: x[1])[0]
                del self._model_cache[lru_key]
                del self._last_accessed[lru_key]
                torch.cuda.empty_cache()
                current_memory = torch.cuda.memory_allocated()
                
        self._model_cache[cache_key] = model
        self._last_accessed[cache_key] = torch.cuda.current_timestamp() if torch.cuda.is_available() else 0

@torch.no_grad()
@validate_input
def preprocess_text_data(text: Union[str, List[str]],
                        model_type: str,
                        batch_mode: bool = False,
                        preprocessing_config: Optional[Dict] = None) -> Union[torch.Tensor, List[torch.Tensor]]:
    """
    Preprocess text data with advanced tokenization and batch support.
    
    Args:
        text: Input text or list of texts
        model_type: Type of model for preprocessing
        batch_mode: Enable batch processing
        preprocessing_config: Additional preprocessing configuration
        
    Returns:
        Preprocessed tensor(s) ready for model input
    """
    config = preprocessing_config or {}
    max_length = config.get('max_length', 512)
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            AIServiceConfig().MODEL_VERSIONS[model_type.lower()]['current']
        )
        
        if batch_mode:
            if not isinstance(text, list):
                text = [text]
            
            # Process in batches
            batches = [text[i:i + MAX_BATCH_SIZE] 
                      for i in range(0, len(text), MAX_BATCH_SIZE)]
            
            processed_batches = []
            for batch in batches:
                encoded = tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=max_length,
                    return_tensors='pt'
                )
                processed_batches.append(encoded)
            
            return processed_batches
            
        else:
            encoded = tokenizer(
                text,
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors='pt'
            )
            return encoded
            
    except Exception as e:
        logger.error(f"Error in text preprocessing: {str(e)}")
        raise

@validate_input
@handle_sparse_matrix
def normalize_features(features: Union[np.ndarray, scipy.sparse.csr_matrix],
                      scaling_method: str = 'robust',
                      outlier_threshold: float = 3.0) -> np.ndarray:
    """
    Normalize features with outlier handling and multiple scaling options.
    
    Args:
        features: Input features array or sparse matrix
        scaling_method: Scaling method ('robust', 'standard', 'minmax')
        outlier_threshold: Threshold for outlier detection
        
    Returns:
        Normalized feature array
    """
    try:
        # Handle null values
        if isinstance(features, np.ndarray):
            features = np.nan_to_num(features, nan=0.0)
        
        # Select scaler based on method
        scalers = {
            'robust': RobustScaler(quantile_range=(25.0, 75.0)),
            'standard': StandardScaler(),
            'minmax': MinMaxScaler(feature_range=(-1, 1))
        }
        
        if scaling_method not in scalers:
            raise ValueError(f"Invalid scaling method. Must be one of {list(scalers.keys())}")
            
        scaler = scalers[scaling_method]
        
        # Handle outliers if using robust scaling
        if scaling_method == 'robust':
            z_scores = np.abs((features - np.mean(features, axis=0)) / np.std(features, axis=0))
            features[z_scores > outlier_threshold] = np.sign(
                features[z_scores > outlier_threshold]) * np.median(np.abs(features), axis=0)
        
        normalized_features = scaler.fit_transform(features)
        
        return normalized_features
        
    except Exception as e:
        logger.error(f"Error in feature normalization: {str(e)}")
        raise