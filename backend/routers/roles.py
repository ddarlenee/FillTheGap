from fastapi import APIRouter, Query
from models.schemas import RoleSearchResponse
from data.skillsfuture_loader import skillsfuture

router = APIRouter()

@router.get("/roles", response_model=RoleSearchResponse)
def get_roles(q: str = Query("", description="Filter roles by name")):
    return RoleSearchResponse(roles=skillsfuture.get_roles(q))
