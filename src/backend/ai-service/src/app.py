import logging
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from prometheus_client import Counter, Histogram, start_http_server
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentation
from circuitbreaker import circuit
import uvicorn

from config import AIServiceConfig
from services.openai_service import OpenAIService
from services.pytorch_service import PyTorchService

# Initialize FastAPI app with production configuration
app = FastAPI(
    title="AI Service",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics
REQUEST_COUNTER = Counter('http_requests_total', 'Total HTTP requests', ['endpoint', 'method'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['endpoint'])
ERROR_COUNTER = Counter('http_errors_total', 'Total HTTP errors', ['endpoint', 'error_type'])

# Request validation models
class CampaignRequest(BaseModel):
    platform: str = Field(..., description="Advertising platform (LinkedIn/Google)")
    objective: str = Field(..., description="Campaign objective")
    target_audience: Dict = Field(..., description="Target audience parameters")
    budget: float = Field(..., gt=0, description="Campaign budget")
    constraints: Optional[Dict] = Field(default={}, description="Campaign constraints")
    correlation_id: Optional[str] = Field(default=None, description="Request correlation ID")

    @validator('platform')
    def validate_platform(cls, v):
        if v.lower() not in ['linkedin', 'google']:
            raise ValueError("Platform must be either 'linkedin' or 'google'")
        return v.lower()

    @validator('budget')
    def validate_budget(cls, v):
        if v <= 0:
            raise ValueError("Budget must be positive")
        return v

class CreativeRequest(BaseModel):
    campaign_id: str = Field(..., description="Campaign ID")
    platform: str = Field(..., description="Advertising platform")
    creative_type: str = Field(..., description="Type of creative")
    brand_guidelines: Optional[Dict] = Field(default={}, description="Brand guidelines")
    performance_data: Optional[Dict] = Field(default=None, description="Historical performance data")

# Initialize services
config = AIServiceConfig()
openai_service = OpenAIService(config)
pytorch_service = PyTorchService(config)

# Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    REQUEST_LATENCY.labels(endpoint=request.url.path).observe(process_time)
    return response

@app.on_event("startup")
async def startup_event():
    """Initialize services and monitoring on startup"""
    try:
        # Start Prometheus metrics server
        start_http_server(8000)
        
        # Initialize OpenTelemetry
        tracer = trace.get_tracer(__name__)
        FastAPIInstrumentation.instrument_app(app)
        
        # Validate configurations
        if not config.validate_config():
            raise ValueError("Invalid service configuration")
        
        logger.info("AI Service started successfully")
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown"""
    try:
        await openai_service.close()
        pytorch_service.clear_cache()
        logger.info("AI Service shutdown completed")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

@app.post("/api/v1/campaign/generate")
@circuit(failure_threshold=5, recovery_timeout=30)
async def generate_campaign(campaign_request: CampaignRequest) -> Dict:
    """Generate AI-optimized campaign structure"""
    try:
        REQUEST_COUNTER.labels(
            endpoint='/api/v1/campaign/generate',
            method='POST'
        ).inc()

        # Generate campaign structure
        campaign_structure = await openai_service.generate_campaign_structure({
            'platform': campaign_request.platform,
            'objective': campaign_request.objective,
            'target_audience': campaign_request.target_audience,
            'budget': campaign_request.budget,
            'constraints': campaign_request.constraints
        })

        # Predict performance metrics
        performance_prediction = pytorch_service.predict(
            model_name='campaign_performance',
            input_data={'campaign_structure': campaign_structure},
            prediction_config={'model_type': 'CUSTOM'}
        )

        return {
            'campaign_structure': campaign_structure,
            'performance_prediction': performance_prediction,
            'correlation_id': campaign_request.correlation_id
        }

    except Exception as e:
        ERROR_COUNTER.labels(
            endpoint='/api/v1/campaign/generate',
            error_type=type(e).__name__
        ).inc()
        logger.error(f"Campaign generation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/v1/creative/generate")
@circuit(failure_threshold=5, recovery_timeout=30)
async def generate_creative(creative_request: CreativeRequest) -> Dict:
    """Generate AI-optimized ad creative"""
    try:
        REQUEST_COUNTER.labels(
            endpoint='/api/v1/creative/generate',
            method='POST'
        ).inc()

        creative_variations = await openai_service.generate_ad_creative(
            creative_params={
                'platform': creative_request.platform,
                'creative_type': creative_request.creative_type,
                'brand_guidelines': creative_request.brand_guidelines
            },
            performance_data=creative_request.performance_data
        )

        return {
            'creative_variations': creative_variations,
            'campaign_id': creative_request.campaign_id
        }

    except Exception as e:
        ERROR_COUNTER.labels(
            endpoint='/api/v1/creative/generate',
            error_type=type(e).__name__
        ).inc()
        logger.error(f"Creative generation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/v1/health")
async def health_check() -> Dict:
    """Health check endpoint"""
    try:
        # Verify service dependencies
        config.validate_config()
        await openai_service.generate_campaign_structure({'test': True})
        pytorch_service.predict('test_model', {'test': True}, {'test': True})
        
        return {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': app.version
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={'status': 'unhealthy', 'error': str(e)}
        )

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8080,
        workers=4,
        log_level="info",
        reload=False
    )