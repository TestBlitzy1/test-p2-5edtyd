import numpy as np
import torch
import sklearn
import fasttext
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from functools import wraps

from utils.ml_utils import preprocess_text_data, normalize_features
from services.pytorch_service import PyTorchService

# Package versions
# numpy==1.24.0
# torch==2.0.0
# scikit-learn==1.3.0
# fasttext==0.9.2

# Global constants
AUDIENCE_FEATURES = ["industry", "company_size", "location", "interests", "behavior", "language"]
SIMILARITY_THRESHOLD = 0.85
BATCH_SIZE = 32
CACHE_TTL = 3600  # 1 hour
SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "zh", "ja"]
PLATFORM_CONFIGS = {
    "linkedin": {
        "feature_weights": {
            "industry": 0.3,
            "company_size": 0.2,
            "location": 0.2,
            "interests": 0.15,
            "behavior": 0.1,
            "language": 0.05
        },
        "min_audience_size": 1000,
        "max_segments": 5
    },
    "google_ads": {
        "feature_weights": {
            "interests": 0.3,
            "behavior": 0.25,
            "location": 0.2,
            "industry": 0.15,
            "company_size": 0.05,
            "language": 0.05
        },
        "min_audience_size": 500,
        "max_segments": 10
    }
}

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

def performance_monitored(func):
    """Decorator for monitoring function performance."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.now()
        try:
            result = func(*args, **kwargs)
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"{func.__name__} executed in {execution_time:.2f} seconds")
            return result
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    return wrapper

@validate_input
def preprocess_audience_data(audience_data: Dict[str, Any], 
                           platform: str,
                           language: str) -> Dict[str, torch.Tensor]:
    """
    Preprocess audience data with platform-specific optimizations.
    
    Args:
        audience_data: Raw audience data dictionary
        platform: Target advertising platform
        language: Content language
        
    Returns:
        Preprocessed features as tensors
    """
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")
        
    if platform not in PLATFORM_CONFIGS:
        raise ValueError(f"Unsupported platform: {platform}")
        
    try:
        # Extract and validate features
        features = {}
        platform_config = PLATFORM_CONFIGS[platform]
        
        for feature in AUDIENCE_FEATURES:
            if feature not in audience_data:
                raise ValueError(f"Missing required feature: {feature}")
                
            raw_value = audience_data[feature]
            
            # Apply platform-specific preprocessing
            if feature in ["industry", "interests"]:
                processed_value = preprocess_text_data(
                    raw_value,
                    model_type="BERT",
                    preprocessing_config={"language": language}
                )
            elif feature in ["behavior"]:
                processed_value = normalize_features(
                    np.array(raw_value),
                    scaling_method="robust"
                )
            else:
                processed_value = torch.tensor(raw_value)
                
            # Apply feature weights
            features[feature] = processed_value * platform_config["feature_weights"][feature]
            
        return features
        
    except Exception as e:
        logger.error(f"Error preprocessing audience data: {str(e)}")
        raise

class AudienceAnalyzer:
    """Enterprise-grade audience analyzer with multi-platform support."""
    
    def __init__(self,
                 model_path: str,
                 model_config: Dict[str, Any],
                 platform: str,
                 performance_config: Dict[str, Any]):
        """
        Initialize the audience analyzer with platform-specific settings.
        
        Args:
            model_path: Path to the ML model
            model_config: Model configuration parameters
            platform: Target advertising platform
            performance_config: Performance monitoring settings
        """
        if platform not in PLATFORM_CONFIGS:
            raise ValueError(f"Unsupported platform: {platform}")
            
        self._platform = platform
        self._platform_config = PLATFORM_CONFIGS[platform]
        self._performance_config = performance_config
        self._cache = {}
        self._last_cache_cleanup = datetime.now()
        
        # Initialize PyTorch service
        self._pytorch_service = PyTorchService({
            "model_path": model_path,
            "model_config": model_config,
            "platform_config": self._platform_config,
            "cache_enabled": True
        })
        
        logger.info(f"AudienceAnalyzer initialized for platform: {platform}")

    @performance_monitored
    def analyze_audience(self,
                        audience_data: Dict[str, Any],
                        analysis_params: Dict[str, Any],
                        language: str) -> Dict[str, Any]:
        """
        Perform comprehensive audience analysis with platform optimization.
        
        Args:
            audience_data: Raw audience data
            analysis_params: Analysis configuration
            language: Content language
            
        Returns:
            Detailed audience analysis results
        """
        try:
            # Check cache
            cache_key = f"{hash(str(audience_data))}_{language}"
            if cache_key in self._cache:
                cache_entry = self._cache[cache_key]
                if (datetime.now() - cache_entry["timestamp"]).seconds < CACHE_TTL:
                    logger.info("Using cached audience analysis")
                    return cache_entry["result"]
                    
            # Preprocess audience data
            processed_features = preprocess_audience_data(
                audience_data,
                self._platform,
                language
            )
            
            # Generate embeddings
            embeddings = self._pytorch_service.predict(
                "audience_embeddings",
                {"features": processed_features},
                {"batch_size": BATCH_SIZE}
            )
            
            # Perform segmentation
            segments = self._segment_audience(
                embeddings["prediction"],
                analysis_params
            )
            
            # Generate insights
            insights = self._generate_audience_insights(
                segments,
                audience_data
            )
            
            # Prepare result
            result = {
                "segments": segments,
                "insights": insights,
                "recommendations": self._generate_recommendations(insights),
                "platform_specific": self._get_platform_specific_metrics(segments),
                "analysis_metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "platform": self._platform,
                    "language": language,
                    "version": "2.0.0"
                }
            }
            
            # Cache result
            self._cache[cache_key] = {
                "result": result,
                "timestamp": datetime.now()
            }
            
            # Cleanup old cache entries
            self._cleanup_cache()
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing audience: {str(e)}")
            raise

    def _segment_audience(self,
                         embeddings: List[float],
                         params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate optimized audience segments."""
        try:
            segments = []
            clustering_result = sklearn.cluster.KMeans(
                n_clusters=min(
                    params.get("max_segments", self._platform_config["max_segments"]),
                    len(embeddings)
                )
            ).fit(embeddings)
            
            for i, center in enumerate(clustering_result.cluster_centers_):
                segment = {
                    "id": f"segment_{i}",
                    "size": np.sum(clustering_result.labels_ == i),
                    "center": center.tolist(),
                    "cohesion": self._calculate_segment_cohesion(
                        embeddings[clustering_result.labels_ == i]
                    )
                }
                segments.append(segment)
                
            return segments
            
        except Exception as e:
            logger.error(f"Error in audience segmentation: {str(e)}")
            raise

    def _generate_audience_insights(self,
                                  segments: List[Dict[str, Any]],
                                  raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate platform-specific audience insights."""
        try:
            return {
                "total_audience_size": sum(seg["size"] for seg in segments),
                "segment_distribution": {
                    seg["id"]: seg["size"] for seg in segments
                },
                "key_characteristics": self._extract_key_characteristics(
                    segments,
                    raw_data
                ),
                "platform_metrics": {
                    "estimated_reach": self._estimate_platform_reach(segments),
                    "targeting_score": self._calculate_targeting_score(segments)
                }
            }
        except Exception as e:
            logger.error(f"Error generating insights: {str(e)}")
            raise

    def _cleanup_cache(self):
        """Remove expired cache entries."""
        current_time = datetime.now()
        expired_keys = [
            k for k, v in self._cache.items()
            if (current_time - v["timestamp"]).seconds > CACHE_TTL
        ]
        for k in expired_keys:
            del self._cache[k]

    def _calculate_segment_cohesion(self, segment_embeddings: np.ndarray) -> float:
        """Calculate internal cohesion of a segment."""
        return float(np.mean(np.linalg.norm(
            segment_embeddings - np.mean(segment_embeddings, axis=0),
            axis=1
        )))

    def _extract_key_characteristics(self,
                                   segments: List[Dict[str, Any]],
                                   raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key characteristics from segments."""
        return {
            "dominant_industries": self._get_dominant_features(raw_data["industry"]),
            "size_distribution": self._analyze_size_distribution(raw_data["company_size"]),
            "geographic_concentration": self._analyze_geographic_distribution(
                raw_data["location"]
            )
        }

    def _generate_recommendations(self, insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate platform-specific targeting recommendations."""
        return [
            {
                "type": "targeting",
                "action": "optimize",
                "parameters": self._get_optimization_parameters(insights)
            },
            {
                "type": "budget",
                "action": "allocate",
                "parameters": self._get_budget_allocation(insights)
            }
        ]

    def _get_platform_specific_metrics(self,
                                     segments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate platform-specific performance metrics."""
        return {
            "estimated_cpm": self._estimate_cpm(segments),
            "audience_quality_score": self._calculate_quality_score(segments),
            "platform_reach_index": self._calculate_reach_index(segments)
        }