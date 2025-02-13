import torch
import numpy as np
import logging
from typing import Dict, List, Optional

from services.openai_service import OpenAIService
from utils.ml_utils import ModelManager, preprocess_text_data

# Constants for creative generation and optimization
CREATIVE_TYPES = ["headline", "description", "call_to_action", "display_url", "sitelink_extension"]
MAX_VARIATIONS = 5
MIN_SCORE_THRESHOLD = 0.7
PLATFORM_CONSTRAINTS = {
    "linkedin": {"headline_length": 150, "description_length": 600},
    "google": {"headline_length": 30, "description_length": 90}
}
CACHE_TTL = 3600

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate_creative_params(creative_params: Dict, platform: str) -> bool:
    """
    Validates creative parameters against platform-specific constraints.
    
    Args:
        creative_params: Dictionary containing creative parameters
        platform: Target advertising platform
        
    Returns:
        bool: True if parameters are valid
        
    Raises:
        ValueError: If parameters violate platform constraints
    """
    if platform not in PLATFORM_CONSTRAINTS:
        raise ValueError(f"Unsupported platform: {platform}")
        
    constraints = PLATFORM_CONSTRAINTS[platform]
    
    # Validate required fields
    required_fields = ["objective", "target_audience", "brand_guidelines"]
    missing_fields = [field for field in required_fields if field not in creative_params]
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
        
    # Validate text lengths
    if "headline" in creative_params:
        if len(creative_params["headline"]) > constraints["headline_length"]:
            raise ValueError(f"Headline exceeds {platform} length limit")
            
    if "description" in creative_params:
        if len(creative_params["description"]) > constraints["description_length"]:
            raise ValueError(f"Description exceeds {platform} length limit")
            
    return True

def score_creative(creative_text: str, creative_type: str, historical_performance: Dict) -> Dict:
    """
    Scores creative content based on multiple performance metrics.
    
    Args:
        creative_text: Generated creative content
        creative_type: Type of creative content
        historical_performance: Historical performance data
        
    Returns:
        Dict containing quality score and improvement suggestions
    """
    # Preprocess text for scoring
    preprocessed_text = preprocess_text_data(
        creative_text,
        model_type="BERT",
        preprocessing_config={"max_length": 512}
    )
    
    # Calculate base quality score
    quality_score = 0.0
    
    # Length optimization score
    optimal_lengths = {
        "headline": 25,
        "description": 70,
        "call_to_action": 15
    }
    length_score = 1.0 - abs(len(creative_text) - optimal_lengths.get(creative_type, 50)) / 100
    quality_score += length_score * 0.3
    
    # Historical performance correlation
    if historical_performance and creative_type in historical_performance:
        hist_score = min(historical_performance[creative_type].get("ctr", 0.0) / 0.05, 1.0)
        quality_score += hist_score * 0.4
        
    # Generate improvement suggestions
    suggestions = []
    if length_score < 0.7:
        suggestions.append(f"Adjust {creative_type} length closer to {optimal_lengths.get(creative_type)} characters")
        
    return {
        "quality_score": min(quality_score + 0.3, 1.0),  # Add base score
        "improvement_suggestions": suggestions,
        "metrics": {
            "length_score": length_score,
            "historical_correlation": hist_score if historical_performance else None
        }
    }

class CreativeGenerator:
    """
    Advanced creative content generator with performance optimization and A/B testing support.
    """
    
    def __init__(self, openai_service: OpenAIService, model_manager: ModelManager, config: Dict):
        """
        Initialize creative generator with required services and configuration.
        
        Args:
            openai_service: OpenAI service instance
            model_manager: Model manager instance
            config: Configuration dictionary
        """
        self._openai_service = openai_service
        self._model_manager = model_manager
        self._logger = logging.getLogger(__name__)
        self._performance_cache = {}
        self._platform_constraints = PLATFORM_CONSTRAINTS
        
        # Validate configuration
        if not config.get("enable_gpu", True) and torch.cuda.is_available():
            self._logger.warning("GPU available but disabled in configuration")

    async def generate_creative(
        self,
        creative_params: Dict,
        platform: str,
        creative_type: str,
        performance_data: Optional[Dict] = None
    ) -> Dict:
        """
        Generates optimized creative content with A/B testing variations.
        
        Args:
            creative_params: Parameters for creative generation
            platform: Target advertising platform
            creative_type: Type of creative content
            performance_data: Optional historical performance data
            
        Returns:
            Dict containing optimized creative variations and metadata
        """
        try:
            # Validate parameters
            validate_creative_params(creative_params, platform)
            
            # Check cache for similar requests
            cache_key = f"{platform}_{creative_type}_{hash(str(creative_params))}"
            if cache_key in self._performance_cache:
                return self._performance_cache[cache_key]
                
            # Generate initial variations
            variations = await self._openai_service.generate_ad_creative(
                creative_params,
                performance_data
            )
            
            # Score and optimize variations
            scored_variations = []
            for variation in variations[:MAX_VARIATIONS]:
                score_result = score_creative(
                    variation["content"],
                    creative_type,
                    performance_data
                )
                
                if score_result["quality_score"] >= MIN_SCORE_THRESHOLD:
                    scored_variations.append({
                        "content": variation["content"],
                        "score": score_result["quality_score"],
                        "suggestions": score_result["improvement_suggestions"],
                        "metrics": score_result["metrics"]
                    })
            
            # Prepare A/B testing groups
            ab_variations = sorted(scored_variations, key=lambda x: x["score"], reverse=True)[:3]
            
            result = {
                "variations": ab_variations,
                "metadata": {
                    "platform": platform,
                    "creative_type": creative_type,
                    "generation_timestamp": np.datetime64('now'),
                    "performance_metrics": {
                        "average_quality_score": np.mean([v["score"] for v in ab_variations]),
                        "top_variation_score": ab_variations[0]["score"] if ab_variations else 0
                    }
                }
            }
            
            # Cache results
            self._performance_cache[cache_key] = result
            
            return result
            
        except Exception as e:
            self._logger.error(f"Creative generation failed: {str(e)}")
            raise

    async def optimize_creative(
        self,
        creative_text: str,
        performance_data: Dict,
        ab_test_results: Optional[Dict] = None
    ) -> Dict:
        """
        Optimizes existing creative content using performance data and A/B test results.
        
        Args:
            creative_text: Existing creative content
            performance_data: Current performance metrics
            ab_test_results: Optional A/B testing results
            
        Returns:
            Dict containing optimization results and suggestions
        """
        try:
            # Analyze current performance
            current_score = score_creative(
                creative_text,
                performance_data.get("creative_type", "headline"),
                performance_data
            )
            
            # Process A/B test results if available
            if ab_test_results:
                winning_variation = max(
                    ab_test_results["variations"],
                    key=lambda x: x.get("conversion_rate", 0)
                )
                
                optimization_basis = winning_variation
            else:
                optimization_basis = {"content": creative_text, "metrics": performance_data}
            
            # Generate optimization suggestions
            optimized_result = await self._openai_service.optimize_creative(
                optimization_basis["content"],
                performance_data
            )
            
            return {
                "original_score": current_score["quality_score"],
                "optimized_content": optimized_result["content"],
                "optimization_score": score_creative(
                    optimized_result["content"],
                    performance_data.get("creative_type", "headline"),
                    performance_data
                )["quality_score"],
                "improvement_suggestions": optimized_result.get("suggestions", []),
                "performance_metrics": {
                    "current": performance_data,
                    "ab_test_results": ab_test_results
                }
            }
            
        except Exception as e:
            self._logger.error(f"Creative optimization failed: {str(e)}")
            raise