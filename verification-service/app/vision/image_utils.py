from __future__ import annotations

from io import BytesIO

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageOps

from app.common.exceptions import ValidationAppError

BGRImage = NDArray[np.uint8]


def decode_image(data: bytes) -> BGRImage:
    try:
        pil_image = Image.open(BytesIO(data))
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image, dtype=np.uint8)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValidationAppError("Invalid image data")
        return image


def enhance_for_detection(image: BGRImage) -> BGRImage:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    merged = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def resize(image: BGRImage, scale: float) -> BGRImage:
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def blur_variance(crop: BGRImage | None) -> float:
    if crop is None or crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
