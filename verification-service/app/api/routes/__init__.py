from fastapi import APIRouter

from .verification import router as verification_router

router = APIRouter()
router.include_router(verification_router)

