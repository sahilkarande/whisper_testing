from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import whisper
import shutil
import os

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

print("Loading Whisper model... This may take a moment.")
model = whisper.load_model("tiny.en")
print("Model loaded successfully.")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend(request: Request):
    """
    Serves the testing_page.html frontend page.
    """
    return templates.TemplateResponse("testing_page.html", {"request": request})

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Endpoint to receive an audio file and return its transcription using Whisper.
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file uploaded")

    temp_file_path = "temp_audio.webm"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        result = model.transcribe(temp_file_path)
        transcription = result.get("text", "").strip()

        return {"transcription": transcription}

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Transcription failed: {str(e)}"},
        )
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)