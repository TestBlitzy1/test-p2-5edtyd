from pathlib import Path
from setuptools import setup, find_packages

# Define paths
HERE = Path(__file__).parent.absolute()
README = HERE / 'README.md'
REQUIREMENTS = HERE / 'requirements.txt'

def get_long_description() -> str:
    """Read and return the content of README.md file."""
    with open(README, 'r', encoding='utf-8') as f:
        return f.read()

def get_requirements() -> list[str]:
    """Read and return the list of package requirements."""
    with open(REQUIREMENTS, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f.readlines() 
                if line.strip() and not line.startswith('#')]

setup(
    name='ai-service',
    version='1.0.0',
    description='AI-powered campaign generation and optimization service for digital advertising platforms',
    long_description=get_long_description(),
    long_description_content_type='text/markdown',
    author='Sales Intelligence Platform Team',
    author_email='team@salesintelligence.com',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    python_requires='>=3.11',
    install_requires=[
        'fastapi==0.100.0',
        'uvicorn==0.22.0',
        'pydantic==2.0.0',
        'openai==1.0.0',
        'torch==2.0.0',
        'numpy==1.24.0',
        'pandas==2.0.0',
        'scikit-learn==1.3.0',
        'python-dotenv==1.0.0',
        'requests==2.31.0',
        'prometheus-client==0.17.0',
        'gunicorn==21.2.0',
        'python-jose==3.3.0',
        'passlib==1.7.4'
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-cov>=4.0.0',
            'pytest-asyncio>=0.21.0',
            'black>=23.0.0',
            'isort>=5.12.0',
            'mypy>=1.0.0',
            'pylint>=2.17.0',
            'safety>=2.3.0'
        ]
    },
    entry_points={
        'console_scripts': [
            'ai-service=ai_service.app:main'
        ]
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3.11',
        'Operating System :: OS Independent',
        'Topic :: Scientific/Engineering :: Artificial Intelligence',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'License :: OSI Approved :: MIT License'
    ]
)