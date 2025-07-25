from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import whisper
import shutil
import os
import warnings
import logging
from pathlib import Path
import tempfile
from typing import Optional
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Therapy Connect - Whisper Transcription API",
    description="Advanced AI-powered transcription tool for therapy sessions",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories if they don't exist
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Suppress Whisper warnings
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")
warnings.filterwarnings("ignore", category=UserWarning)

# Global variables
model: Optional[whisper.Whisper] = None
model_loading = False

def load_whisper_model():
    """Load Whisper model with error handling"""
    global model, model_loading
    
    if model_loading:
        logger.info("Model is already being loaded...")
        return False
        
    model_loading = True
    
    try:
        logger.info("Loading Whisper model... This may take a moment.")
        
        # Try different model sizes based on availability
        model_sizes = ["tiny.en", "tiny", "base.en", "base"]
        
        for model_size in model_sizes:
            try:
                logger.info(f"Attempting to load {model_size} model...")
                model = whisper.load_model(model_size, device="cpu")
                logger.info(f"Whisper model '{model_size}' loaded successfully.")
                model_loading = False
                return True
            except Exception as e:
                logger.warning(f"Failed to load {model_size}: {e}")
                continue
                
        logger.error("Failed to load any Whisper model")
        model_loading = False
        return False
        
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        logger.error(traceback.format_exc())
        model_loading = False
        return False

# Load model on startup
@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    logger.info("Starting Therapy Connect application...")
    success = load_whisper_model()
    if not success:
        logger.warning("Application started without Whisper model. Transcription will not work.")
    logger.info("Application startup complete.")

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "version": "1.0.0"
    }

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Endpoint to receive an audio file and return its transcription using Whisper.
    """
    logger.info(f"Received transcription request for file: {audio.filename}")
    
    if model_loading:
        raise HTTPException(
            status_code=503, 
            detail="Whisper model is still loading. Please wait a moment and try again."
        )
    
    if not model:
        logger.error("Whisper model not loaded")
        raise HTTPException(
            status_code=503, 
            detail="Whisper model not loaded. Please restart the server or check the logs."
        )
    
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file uploaded")
    
    # Log file info
    logger.info(f"File info - Name: {audio.filename}, Content-Type: {audio.content_type}")
    
    # Create temporary file
    temp_file = None
    try:
        # Determine file extension
        file_extension = Path(audio.filename).suffix.lower()
        if not file_extension:
            # Default to webm if no extension
            file_extension = '.webm'
        
        logger.info(f"Using file extension: {file_extension}")
        
        # Create temporary file with proper extension
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        
        # Read and copy uploaded file to temporary file
        content = await audio.read()
        temp_file.write(content)
        temp_file.close()
        
        file_size = len(content)
        logger.info(f"Audio file saved to temp file: {temp_file.name}, size: {file_size} bytes")
        
        if file_size == 0:
            raise ValueError("Uploaded file is empty")
        
        if file_size > 25 * 1024 * 1024:  # 25MB limit
            raise ValueError("File too large (max 25MB)")
        
        logger.info("Starting Whisper transcription...")
        
        # Transcribe with Whisper
        result = model.transcribe(
            temp_file.name, 
            fp16=False,
            language='en',  # Force English for better performance
            task='transcribe',
            verbose=False
        )
        
        transcription = result.get("text", "").strip()
        language = result.get("language", "en")
        
        # Log transcription info
        word_count = len(transcription.split()) if transcription else 0
        logger.info(f"Transcription completed successfully. Word count: {word_count}, Language: {language}")
        
        if not transcription:
            logger.warning("No transcription text returned from Whisper")
        
        return {
            "transcription": transcription,
            "word_count": word_count,
            "language": language,
            "status": "success",
            "file_size": file_size
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Transcription failed: {error_msg}")
        logger.error(traceback.format_exc())
        
        # Return more specific error messages
        if "No such file or directory" in error_msg:
            error_msg = "Failed to process audio file. Please try a different format."
        elif "could not find codec" in error_msg.lower():
            error_msg = "Unsupported audio format. Please use WAV, MP3, or WebM."
        elif "File too large" in error_msg:
            error_msg = "File too large. Please use a file smaller than 25MB."
        elif "empty" in error_msg.lower():
            error_msg = "The uploaded file appears to be empty or corrupted."
        
        return JSONResponse(
            status_code=500,
            content={
                "error": error_msg,
                "status": "error"
            },
        )
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                logger.info(f"Cleaned up temporary file: {temp_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file: {e}")

@app.post("/submit-transcription")
async def submit_transcription(request: Request):
    """
    Endpoint to handle transcription submission and storage.
    """
    try:
        data = await request.json()
        transcription = data.get("transcription", "")
        timestamp = data.get("timestamp", "")
        word_count = data.get("wordCount", 0)
        notes = data.get("notes", "")
        
        # Log the submission
        logger.info(f"Transcription submission received:")
        logger.info(f"Timestamp: {timestamp}")
        logger.info(f"Word Count: {word_count}")
        logger.info(f"Transcription length: {len(transcription)} characters")
        
        # Here you can add database storage, file saving, or other processing
        # For example:
        # - Save to database
        # - Send email notification
        # - Generate reports
        # - Export to external systems
        
        return {
            "status": "success", 
            "message": "Transcription submitted successfully",
            "id": f"trans_{timestamp}_{word_count}"
        }
        
    except Exception as e:
        logger.error(f"Submission failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Submission failed: {str(e)}",
                "status": "error"
            },
        )

@app.get("/api/stats")
async def get_stats():
    """Get application statistics"""
    model_name = None
    if model:
        # Try to get model name from the model object
        try:
            model_name = getattr(model, 'name', 'whisper-model')
        except:
            model_name = 'whisper-model'
    
    return {
        "model_info": {
            "loaded": model is not None,
            "loading": model_loading,
            "model_name": model_name
        },
        "supported_formats": [
            "audio/webm", "audio/wav", "audio/mp3", 
            "audio/m4a", "audio/ogg", "audio/flac"
        ],
        "max_file_size": "25MB",
        "languages": ["en", "auto-detect"]
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    logger.warning(f"404 error for path: {request.url.path}")
    return templates.TemplateResponse(
        "index.html", 
        {"request": request}, 
        status_code=404
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status": "error"}
    )

if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Therapy Connect server...")
    uvicorn.run(
        "main:app", 
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
