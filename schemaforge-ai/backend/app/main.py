from contextlib import asynccontextmanager
from collections import defaultdict, deque
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import settings
from app.services.persistence import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SchemaForge AI API",
    description="Plain English → Universal Database Schema Generator (OpenAI-powered)",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

_RATE_LIMIT_WINDOW_SECONDS = 3600
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_exempt_paths = {
    "/",
    "/docs",
    "/health",
    "/openapi.json",
    "/redoc",
}


def _client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    limit = settings.rate_limit_per_hour
    if request.method == "OPTIONS" or request.url.path in _rate_limit_exempt_paths or limit <= 0:
        return await call_next(request)

    now = monotonic()
    key = _client_key(request)
    bucket = _rate_limit_buckets[key]
    while bucket and now - bucket[0] >= _RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= limit:
        retry_after = max(1, int(_RATE_LIMIT_WINDOW_SECONDS - (now - bucket[0])))
        return JSONResponse(
            {"detail": "Rate limit exceeded. Try again later."},
            status_code=429,
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
            },
        )

    bucket.append(now)
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(bucket)))
    return response


@app.get("/")
def root():
    return {
        "message": "SchemaForge AI API",
        "docs": "/docs",
        "openai": bool(settings.llm_api_key),
    }
