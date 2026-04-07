from io import BytesIO
from PIL import Image, ImageOps, ImageFilter


def preprocess_ktp_image(file_bytes: bytes) -> bytes:
    image = Image.open(BytesIO(file_bytes)).convert("RGB")

    image = ImageOps.exif_transpose(image)
    image = ImageOps.autocontrast(image)

    min_width = 1400
    if image.width < min_width:
        ratio = min_width / image.width
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size)

    image = image.filter(ImageFilter.SHARPEN)

    output = BytesIO()
    image.save(output, format="JPEG", quality=95)
    return output.getvalue()