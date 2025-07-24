import os
import shutil
import pymysql.cursors
import whisper
from fastapi import (
    FastAPI, File, UploadFile, Form,
    Request, Depends, HTTPException, status
)
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from datetime import datetime, timedelta
from difflib import SequenceMatcher


# Config
SECRET_KEY = "abc123"  # Change for production! Keep secret.
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# Initialize FastAPI app
app = FastAPI()

# Mount static files and setup templates folder
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# DB Connection (adjust as needed)
db = pymysql.connect(
    host="localhost",
    user="root",
    password="Miemesmifuture@2001",
    database="whisperdb",
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=False
)

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Load whisper model once
print("Loading Whisper model. This may take some moment...")
model = whisper.load_model("tiny.en")
print("Whisper model loaded.")


# Pydantic models
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str


# Helper functions

def get_user_by_username(username: str):
    with db.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
    return user

def create_user(user: UserCreate):
    hashed_pw = pwd_context.hash(user.password)
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO users (username, email, hashed_password) VALUES (%s, %s, %s)",
            (user.username, user.email, hashed_pw)
        )
    db.commit()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(username: str, password: str):
    user = get_user_by_username(username)
    if user and verify_password(password, user['hashed_password']):
        return user
    return None

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_username(username)
    if user is None:
        raise credentials_exception
    return user


def similarity_score(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return round(SequenceMatcher(None, a.lower(), b.lower()).ratio() * 100, 2)

def insert_transcription(user_id: int, transcript: str, manual: str, score: float):
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO transcription_history (user_id, transcript, manual, score) VALUES (%s, %s, %s, %s)",
            (user_id, transcript, manual, score)
        )
    db.commit()

def get_transcriptions(user_id: int, limit: int = 20):
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, transcript, manual, score, timestamp FROM transcription_history WHERE user_id = %s ORDER BY timestamp DESC LIMIT %s",
            (user_id, limit)
        )
        return cur.fetchall()

def delete_transcription(user_id: int, transcription_id: int):
    with db.cursor() as cur:
        cur.execute(
            "DELETE FROM transcription_history WHERE user_id = %s AND id = %s",
            (user_id, transcription_id)
        )
    db.commit()


# Routes

@app.post("/signup", status_code=201)
async def signup(user: UserCreate):
    if get_user_by_username(user.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    create_user(user)
    return {"message": "User created successfully"}

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Public login page at '/'
@app.get("/", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Authenticated main app at '/app'
@app.get("/app", response_class=HTMLResponse)
async def app_home(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse("index.html", {"request": request, "user": current_user})

@app.get("/index", response_class=HTMLResponse)
async def app_home(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse("index.html", {"request": request, "user": current_user})


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    manual_text: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file uploaded")

    temp_path = "temp_audio.webm"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        result = model.transcribe(temp_path)
        transcription = result.get("text", "").strip()

        score = similarity_score(transcription, manual_text.strip())

        insert_transcription(current_user["id"], transcription, manual_text, score)

        return JSONResponse({"transcription": transcription, "score": score})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/history")
async def history(current_user: dict = Depends(get_current_user), limit: int = 20):
    records = get_transcriptions(current_user["id"], limit)
    return records

@app.delete("/api/history/{transcription_id}")
async def delete_history(transcription_id: int, current_user: dict = Depends(get_current_user)):
    delete_transcription(current_user["id"], transcription_id)
    return {"success": True}

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})
