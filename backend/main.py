from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload as upload_router
from routers import session as session_router
from data.skillsfuture_loader import skillsfuture

@asynccontextmanager
async def lifespan(app: FastAPI):
    skillsfuture.load()
    yield

app = FastAPI(title="Skills Analyser", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router.router, prefix="/api")
app.include_router(session_router.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
