import argparse
import base64
import io
import json
import logging
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import torch
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MODEL_LOCK = threading.Lock()
MODEL = None
OPTIONS = None
LOG = logging.getLogger("form_and_folio")


def load_model():
    global MODEL, OPTIONS
    if MODEL is not None:
        return MODEL, OPTIONS

    from models.models import create_model
    from options.test_options import TestOptions

    parser = TestOptions()
    parser.initialize()
    options = parser.parser.parse_args([
        "--dataroot", str(ROOT / "examples"),
        "--checkpoints_dir", str(ROOT / "checkpoints"),
        "--name", "pretrained",
        "--model", "pix2pix",
        "--which_direction", "AtoB",
        "--which_model_netG", "resnet_9blocks",
        "--input_nc", "3",
        "--output_nc", "1",
        "--norm", "batch",
        "--no_dropout",
        "--no-cuda",
    ])
    options.isTrain = False
    options.use_cuda = False
    MODEL = create_model(options)
    MODEL.netG.eval()
    OPTIONS = options
    return MODEL, OPTIONS


def png_data(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def guide_svg(width, height, bounds):
    left, top, right, bottom = bounds
    box_width = max(1, right - left)
    box_height = max(1, bottom - top)
    vertical_thirds = [left + box_width / 3, left + 2 * box_width / 3]
    horizontal_thirds = [top + box_height / 3, top + 2 * box_height / 3]
    vertical_lines = "".join(
        '<line x1="{:.2f}" y1="{}" x2="{:.2f}" y2="{}"/>'.format(x, top, x, bottom)
        for x in vertical_thirds
    )
    horizontal_lines = "".join(
        '<line x1="{}" y1="{:.2f}" x2="{}" y2="{:.2f}"/>'.format(left, y, right, y)
        for y in horizontal_thirds
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="{0}" height="{1}" '
        'viewBox="0 0 {0} {1}">'
        '<g fill="none" stroke="#d9b46f" stroke-width="{2}" '
        'stroke-dasharray="{3}">'
        '<rect x="{4}" y="{5}" width="{6}" height="{7}" rx="{8}"/>'
        '<line x1="{9:.2f}" y1="{5}" x2="{9:.2f}" y2="{10}"/>'
        '<line x1="{4}" y1="{11:.2f}" x2="{12}" y2="{11:.2f}"/>'
        '{13}{14}'
        '</g></svg>'
    ).format(
        width, height, max(1, min(width, height) / 500),
        max(3, min(width, height) / 40), left, top, box_width, box_height,
        max(2, min(width, height) / 100), left + box_width / 2, bottom,
        top + box_height / 2, right, vertical_lines, horizontal_lines,
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


def process_image(uploaded):
    try:
        with Image.open(io.BytesIO(uploaded)) as opened:
            width, height = opened.size
            if width < 16 or height < 16:
                raise ValueError("Image dimensions must be at least 16 by 16 pixels.")
            if width * height > 40_000_000:
                raise ValueError("This image is too large to process. Please use an image under 40 megapixels.")
            image = ImageOps.exif_transpose(opened)
            if "A" in image.getbands():
                rgba_image = image.convert("RGBA")
                white_background = Image.new("RGBA", rgba_image.size, (255, 255, 255, 255))
                image = Image.alpha_composite(white_background, rgba_image)
            image = image.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("The uploaded file is not a valid JPG, PNG, or WebP image.") from error

    width, height = image.size

    model, options = load_model()
    image_tensor = np.asarray(
        image.resize((options.fineSize, options.fineSize), getattr(Image, "Resampling", Image).BICUBIC),
        dtype=np.float32,
    )
    image_tensor = torch.from_numpy(image_tensor.transpose((2, 0, 1))).unsqueeze(0)
    image_tensor = image_tensor.div(255.0).sub(0.5).div(0.5)
    empty_target = torch.zeros((1, options.output_nc, options.fineSize, options.fineSize))

    with tempfile.TemporaryDirectory(prefix="form-folio-") as temporary_directory:
        model.set_input({
            "A": image_tensor,
            "B": empty_target,
            "A_paths": ["uploaded-image.png"],
            "B_paths": ["uploaded-image.png"],
            "w": [width],
            "h": [height],
        })
        model.test()
        model.write_image(temporary_directory)
        generated_path = Path(temporary_directory) / "uploaded-image.png"
        with Image.open(generated_path) as generated_file:
            generated = generated_file.convert("L")

    # Trace the boundaries of the model's generated linework for the outer-contour stage.
    ink_mask = generated.point(lambda value: 255 if value < 235 else 0)
    eroded_ink = ink_mask.filter(ImageFilter.MinFilter(3))
    boundary = Image.fromarray(
        np.maximum(
            np.asarray(ink_mask, dtype=np.int16) - np.asarray(eroded_ink, dtype=np.int16),
            0,
        ).astype(np.uint8),
        mode="L",
    )
    contour_stage = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    contour_alpha = boundary.point(lambda value: 255 if value else 0)
    contour_stage.putalpha(contour_alpha)

    ink_coordinates = np.argwhere(np.asarray(ink_mask) > 0)
    if ink_coordinates.size:
        top, left = ink_coordinates.min(axis=0)
        bottom, right = ink_coordinates.max(axis=0) + 1
        bounds = (int(left), int(top), int(right), int(bottom))
    else:
        bounds = (0, 0, width, height)

    clean_stage = generated.point(lambda value: 255 if value >= 180 else 0, mode="L")
    return {
        "width": width,
        "height": height,
        "guides": guide_svg(width, height, bounds),
        "contours": "data:image/png;base64," + png_data(contour_stage),
        "details": "data:image/png;base64," + png_data(generated),
        "final": "data:image/png;base64," + png_data(clean_stage),
    }


class DrawingGuideHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    def do_POST(self):
        if urlparse(self.path).path != "/api/generate":
            self.send_json(404, {"error": "Unknown API endpoint."})
            return

        extension = Path(parse_qs(urlparse(self.path).query).get("filename", [""])[0]).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            self.send_json(400, {"error": "Choose a JPG, JPEG, PNG, or WebP image."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "The upload request has an invalid content length."})
            return
        if content_length <= 0 or content_length > MAX_UPLOAD_BYTES:
            self.send_json(413, {"error": "Choose an image file smaller than 20 MB."})
            return

        content_type = self.headers.get_content_type()
        if content_type not in {"image/jpeg", "image/png", "image/webp", "application/octet-stream"}:
            self.send_json(400, {"error": "The uploaded file type does not match a supported image."})
            return

        uploaded = self.rfile.read(content_length)
        try:
            with MODEL_LOCK:
                result = process_image(uploaded)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return
        except (OSError, RuntimeError, KeyError, ImportError) as error:
            LOG.exception("Image processing failed")
            self.send_json(500, {
                "error": "The drawing guide could not be generated. Check that the pretrained model is installed and try again.",
                "detail": str(error),
            })
            return
        except Exception as error:
            LOG.exception("Unexpected drawing guide failure")
            self.send_json(500, {
                "error": "An unexpected image-processing error occurred. Please try again.",
                "detail": str(error),
            })
            return

        self.send_json(200, result)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    argument_parser = argparse.ArgumentParser(description="Run the Form & Folio local drawing-guide app.")
    argument_parser.add_argument("--host", default="127.0.0.1")
    argument_parser.add_argument("--port", type=int, default=8010)
    arguments = argument_parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    server = ThreadingHTTPServer((arguments.host, arguments.port), DrawingGuideHandler)
    LOG.info("Form & Folio is running at http://%s:%s", arguments.host, arguments.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOG.info("Stopping Form & Folio server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
