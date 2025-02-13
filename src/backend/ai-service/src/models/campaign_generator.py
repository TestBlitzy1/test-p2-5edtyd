import numpy as np
import torch
import logging
from typing import Dict, List, Optional, Tuple
from utils.ml_utils import ModelManager
from services.openai_service import OpenAIService

# Constants
SUPPORTED_PLATFORMS = ['linkedin', 'google']
DEFAULT_CAMPAIGN_PARAMS = {
    "budget_allocation": "balanced",
    "optimization_goal": "conversions"
}
MAX_RETRIES = 3
BATCH_SIZE = 32
CACHE_TIMEOUT = 3600

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate_campaign_input(campaign_data: Dict, platform: str) -> Tuple[bool, Dict]:
    """
    Enhanced validation of campaign input data with platform-specific compliance checking.
    
    Args:
        campaign_data: Dictionary containing campaign parameters
        platform: Target advertising platform
        
    Returns:
        Tuple containing validation result (bool) and any validation errors (dict)
    """
    errors = {}
    
    # Validate platform
    if platform not in SUPPORTED_PLATFORMS:
        errors['platform'] = f"Unsupported platform. Must be one of: {SUPPORTED_PLATFORMS}"
        
    # Required fields validation
    required_fields = ['objective', 'target_audience', 'budget', 'industry']
    missing_fields = [field for field in required_fields if field not in campaign_data]
    if missing_fields:
        errors['missing_fields'] = f"Missing required fields: {', '.join(missing_fields)}"
        
    # Budget validation
    if 'budget' in campaign_data:
        try:
            budget = float(campaign_data['budget'])
            if budget <= 0:
                errors['budget'] = "Budget must be greater than 0"
            if platform == 'linkedin' and budget < 10:
                errors['budget'] = "LinkedIn minimum daily budget is $10"
            elif platform == 'google' and budget < 5:
                errors['budget'] = "Google Ads minimum daily budget is $5"
        except ValueError:
            errors['budget'] = "Invalid budget format"
            
    # Audience size validation
    if 'target_audience' in campaign_data:
        audience = campaign_data['target_audience']
        if not isinstance(audience, dict):
            errors['target_audience'] = "Target audience must be a dictionary"
        elif platform == 'linkedin' and 'company_size' not in audience:
            errors['target_audience'] = "LinkedIn campaigns require company size targeting"
            
    return len(errors) == 0, errors

class CampaignGenerator:
    """Enhanced core class for generating AI-optimized advertising campaign structures."""
    
    def __init__(self, model_manager: ModelManager, openai_service: OpenAIService, config: Dict):
        """
        Initialize CampaignGenerator with enhanced features.
        
        Args:
            model_manager: Instance of ModelManager for ML model handling
            openai_service: Instance of OpenAIService for GPT integration
            config: Configuration dictionary
        """
        self._model_manager = model_manager
        self._openai_service = openai_service
        self._logger = logging.getLogger(__name__)
        self._cache = {}
        self._device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self._config = config
        
        # Initialize platform-specific models
        self._platform_models = {
            platform: self._model_manager.get_model(
                f"{platform}_campaign_model",
                "CUSTOM"
            ) for platform in SUPPORTED_PLATFORMS
        }
        
        self._logger.info(f"CampaignGenerator initialized with device: {self._device}")

    async def generate_campaign(self, campaign_data: Dict, platform: str) -> Dict:
        """
        Generate optimized campaign structure with enhanced features.
        
        Args:
            campaign_data: Campaign parameters dictionary
            platform: Target advertising platform
            
        Returns:
            Dictionary containing optimized campaign structure
        """
        # Validate input
        is_valid, errors = validate_campaign_input(campaign_data, platform)
        if not is_valid:
            raise ValueError(f"Invalid campaign data: {errors}")
            
        # Check cache
        cache_key = f"{platform}_{hash(frozenset(campaign_data.items()))}"
        if cache_key in self._cache:
            self._logger.info("Returning cached campaign structure")
            return self._cache[cache_key]
            
        try:
            # Generate base structure using GPT
            base_structure = await self._openai_service.generate_campaign_structure({
                **campaign_data,
                'platform': platform
            })
            
            # Apply platform-specific optimizations
            optimized_structure = await self.generate_platform_specific(
                base_structure,
                platform
            )
            
            # Generate performance predictions
            performance_metrics = self._predict_performance(optimized_structure, platform)
            
            # Combine results
            final_structure = {
                **optimized_structure,
                'predicted_performance': performance_metrics,
                'platform': platform,
                'validation_status': 'success'
            }
            
            # Cache result
            self._cache[cache_key] = final_structure
            
            return final_structure
            
        except Exception as e:
            self._logger.error(f"Campaign generation failed: {str(e)}")
            raise

    async def optimize_structure(self, campaign_structure: Dict, performance_data: Dict) -> Dict:
        """
        Optimize campaign structure using ML models and performance data.
        
        Args:
            campaign_structure: Existing campaign structure
            performance_data: Historical performance metrics
            
        Returns:
            Optimized campaign structure
        """
        platform = campaign_structure.get('platform')
        if platform not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Unsupported platform: {platform}")
            
        try:
            # Load platform-specific model
            model = self._platform_models[platform]
            
            # Prepare input features
            features = self._prepare_optimization_features(
                campaign_structure,
                performance_data
            )
            
            # Generate optimization recommendations
            with torch.no_grad():
                features_tensor = torch.FloatTensor(features).to(self._device)
                recommendations = model(features_tensor)
                
            # Apply optimizations
            optimized_structure = self._apply_optimization_recommendations(
                campaign_structure,
                recommendations
            )
            
            # Validate optimized structure
            if not self._validate_optimized_structure(optimized_structure):
                raise ValueError("Optimization produced invalid campaign structure")
                
            return optimized_structure
            
        except Exception as e:
            self._logger.error(f"Campaign optimization failed: {str(e)}")
            raise

    async def generate_platform_specific(self, base_structure: Dict, platform: str) -> Dict:
        """
        Generate platform-specific optimizations for campaign structure.
        
        Args:
            base_structure: Base campaign structure
            platform: Target advertising platform
            
        Returns:
            Platform-optimized campaign structure
        """
        try:
            model = self._platform_models[platform]
            
            # Apply platform best practices
            platform_optimized = self._apply_platform_best_practices(
                base_structure,
                platform
            )
            
            # Generate targeting recommendations
            targeting = await self._generate_targeting_recommendations(
                platform_optimized,
                platform
            )
            
            # Optimize budget distribution
            budget_allocation = self._optimize_budget_distribution(
                platform_optimized,
                platform
            )
            
            # Combine optimizations
            optimized_structure = {
                **platform_optimized,
                'targeting': targeting,
                'budget_allocation': budget_allocation
            }
            
            return optimized_structure
            
        except Exception as e:
            self._logger.error(f"Platform-specific optimization failed: {str(e)}")
            raise

    def _predict_performance(self, campaign_structure: Dict, platform: str) -> Dict:
        """Generate performance predictions for campaign structure."""
        model = self._platform_models[platform]
        features = self._extract_prediction_features(campaign_structure)
        
        with torch.no_grad():
            features_tensor = torch.FloatTensor(features).to(self._device)
            predictions = model(features_tensor)
            
        return {
            'predicted_ctr': float(predictions[0]),
            'predicted_conversion_rate': float(predictions[1]),
            'predicted_cpa': float(predictions[2])
        }

    def _prepare_optimization_features(self, structure: Dict, performance: Dict) -> np.ndarray:
        """Prepare features for optimization model."""
        features = []
        features.extend(self._encode_campaign_objective(structure['objective']))
        features.extend(self._encode_targeting_params(structure['targeting']))
        features.extend(self._encode_performance_metrics(performance))
        return np.array(features)

    def _apply_platform_best_practices(self, structure: Dict, platform: str) -> Dict:
        """Apply platform-specific best practices to campaign structure."""
        if platform == 'linkedin':
            return self._apply_linkedin_best_practices(structure)
        return self._apply_google_best_practices(structure)

    def _validate_optimized_structure(self, structure: Dict) -> bool:
        """Validate optimized campaign structure."""
        required_fields = ['campaign_name', 'objective', 'targeting', 'budget_allocation', 'ad_groups']
        return all(field in structure for field in required_fields)