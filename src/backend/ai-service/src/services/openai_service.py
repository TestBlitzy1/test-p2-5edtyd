import asyncio
import json
import logging
from typing import Dict, List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import openai  # openai v1.0.0
from functools import wraps

from config import AIServiceConfig

# Campaign structure generation prompt template with dynamic parameters
CAMPAIGN_PROMPT_TEMPLATE = """
Generate an optimized advertising campaign structure with the following parameters:
Platform: {platform}
Objective: {objective}
Target Audience: {target_audience}
Budget: {budget}
Industry: {industry}
Key Performance Metrics: {metrics}

Please provide a detailed campaign structure including:
1. Campaign hierarchy
2. Ad group organization
3. Targeting parameters
4. Budget allocation
5. Bidding strategy
"""

# Creative generation prompt template with performance insights
CREATIVE_PROMPT_TEMPLATE = """
Generate high-performing ad creative variations based on:
Campaign Objective: {objective}
Target Audience: {audience}
Platform: {platform}
Historical Performance: {performance_metrics}
Brand Guidelines: {brand_guidelines}
Creative Type: {creative_type}

Please provide:
1. Headlines (multiple variations)
2. Ad copy (multiple variations)
3. Call-to-action suggestions
4. Creative best practices
"""

# Constants for retry and error handling
MAX_RETRIES = 3
BACKOFF_FACTOR = 2.0
SUCCESS_THRESHOLD = 0.95
ERROR_THRESHOLD = 0.05

def monitor_performance(func):
    """Decorator for monitoring function performance and logging metrics"""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        try:
            start_time = asyncio.get_event_loop().time()
            result = await func(self, *args, **kwargs)
            execution_time = asyncio.get_event_loop().time() - start_time
            
            # Update metrics
            self._metrics[func.__name__] = {
                'execution_time': execution_time,
                'success': True,
                'timestamp': start_time
            }
            
            # Log performance metrics
            self._logger.info(
                f"Function {func.__name__} completed successfully",
                extra={
                    'execution_time': execution_time,
                    'function': func.__name__,
                    'success': True
                }
            )
            return result
            
        except Exception as e:
            self._metrics[func.__name__] = {
                'error': str(e),
                'success': False,
                'timestamp': start_time
            }
            self._logger.error(
                f"Error in {func.__name__}",
                extra={
                    'error': str(e),
                    'function': func.__name__,
                    'success': False
                }
            )
            raise
    return wrapper

def validate_input(func):
    """Decorator for input validation"""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        if len(args) > 1:
            params = args[1]
        else:
            params = kwargs
            
        if not isinstance(params, dict):
            raise ValueError("Input parameters must be a dictionary")
            
        required_fields = ['platform', 'objective', 'target_audience']
        missing_fields = [field for field in required_fields if field not in params]
        
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
            
        return await func(self, *args, **kwargs)
    return wrapper

class OpenAIService:
    """Service class for OpenAI GPT model integration with enhanced reliability and monitoring"""
    
    def __init__(self, config: AIServiceConfig):
        """Initialize OpenAI service with configuration and monitoring"""
        self._config = config
        self._client = openai.AsyncClient(api_key=config.OPENAI_API_KEY)
        self._logger = logging.getLogger(__name__)
        self._metrics = {}
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Validate configuration
        if not self._config.OPENAI_MODEL_VERSION:
            raise ValueError("OpenAI model version not configured")

    @monitor_performance
    @validate_input
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_FACTOR),
        retry=retry_if_exception_type((openai.APIError, openai.APIConnectionError))
    )
    async def generate_campaign_structure(self, campaign_params: Dict) -> Dict:
        """
        Generates campaign structure using GPT model with retries and validation
        
        Args:
            campaign_params: Dictionary containing campaign parameters
            
        Returns:
            Dictionary containing the generated campaign structure
            
        Raises:
            ValueError: If input parameters are invalid
            openai.APIError: If API call fails
        """
        try:
            # Format prompt
            prompt = CAMPAIGN_PROMPT_TEMPLATE.format(**campaign_params)
            
            # Call OpenAI API
            response = await self._client.chat.completions.create(
                model=self._config.OPENAI_MODEL_VERSION,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self._config.MAX_TOKENS,
                temperature=self._config.TEMPERATURE,
                timeout=self._config.REQUEST_TIMEOUT_MS / 1000
            )
            
            # Parse and validate response
            campaign_structure = json.loads(response.choices[0].message.content)
            
            # Validate structure
            if not self._validate_campaign_structure(campaign_structure):
                raise ValueError("Generated campaign structure is invalid")
                
            return campaign_structure
            
        except json.JSONDecodeError as e:
            self._logger.error("Failed to parse API response", extra={'error': str(e)})
            raise ValueError("Invalid API response format")
            
        except Exception as e:
            self._logger.error("Campaign generation failed", extra={'error': str(e)})
            raise

    @monitor_performance
    @validate_input
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_FACTOR),
        retry=retry_if_exception_type((openai.APIError, openai.APIConnectionError))
    )
    async def generate_ad_creative(
        self,
        creative_params: Dict,
        performance_data: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Generates ad creative content using GPT model with performance optimization
        
        Args:
            creative_params: Dictionary containing creative parameters
            performance_data: Optional dictionary containing historical performance data
            
        Returns:
            List of dictionaries containing generated creative variations
            
        Raises:
            ValueError: If input parameters are invalid
            openai.APIError: If API call fails
        """
        try:
            # Format prompt with performance insights
            prompt_params = {**creative_params}
            if performance_data:
                prompt_params['performance_metrics'] = json.dumps(performance_data)
            prompt = CREATIVE_PROMPT_TEMPLATE.format(**prompt_params)
            
            # Call OpenAI API
            response = await self._client.chat.completions.create(
                model=self._config.OPENAI_MODEL_VERSION,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self._config.MAX_TOKENS,
                temperature=self._config.TEMPERATURE,
                timeout=self._config.REQUEST_TIMEOUT_MS / 1000
            )
            
            # Parse and validate response
            creative_variations = json.loads(response.choices[0].message.content)
            
            # Validate creative content
            if not self._validate_creative_content(creative_variations):
                raise ValueError("Generated creative content is invalid")
                
            return creative_variations
            
        except json.JSONDecodeError as e:
            self._logger.error("Failed to parse API response", extra={'error': str(e)})
            raise ValueError("Invalid API response format")
            
        except Exception as e:
            self._logger.error("Creative generation failed", extra={'error': str(e)})
            raise

    def _validate_campaign_structure(self, structure: Dict) -> bool:
        """Validates the generated campaign structure"""
        required_fields = ['campaign_name', 'ad_groups', 'targeting', 'budget']
        return all(field in structure for field in required_fields)

    def _validate_creative_content(self, content: List[Dict]) -> bool:
        """Validates the generated creative content"""
        if not isinstance(content, list) or not content:
            return False
            
        required_fields = ['headline', 'ad_copy', 'call_to_action']
        return all(
            all(field in variation for field in required_fields)
            for variation in content
        )

    async def close(self):
        """Cleanup resources"""
        await self._client.close()