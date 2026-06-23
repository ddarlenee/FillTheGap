from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth as auth_router
from routers import upload as upload_router
from routers import session as session_router
from routers import roles as roles_router
from routers import analyse as analyse_router
from routers import progress as progress_router
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
app.include_router(roles_router.router, prefix="/api")
app.include_router(analyse_router.router, prefix="/api")
app.include_router(progress_router.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
