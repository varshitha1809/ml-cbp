# Architecture Overview

## High-level flow
The application follows a simple browser → API → model flow.

1. A user draws a sketch in the React canvas.
2. The frontend exports the canvas as a PNG.
3. The browser sends the image as multipart form data to the FastAPI backend.
4. The backend validates the file, converts it to a Pillow image, and calls the model handler.
5. The model handler preprocesses the sketch and performs inference with the selected Hugging Face pipeline.
6. The generated image is returned as base64 for the React UI to display.

## Component responsibilities
### Frontend
- `App.jsx` – main layout, dashboard panels, session handling, and generation trigger
- `DrawingCanvas.jsx` – canvas logic for drawing, undo/redo, brush configuration, and reference overlay
- `ImageDisplay.jsx` – placeholder, loading, and result rendering

### Backend
- `app.py` – API endpoints and request validation
- `model_handler.py` – model loading, preprocessing, and inference

## Why this architecture is suitable
- It preserves the original repo and avoids a destructive migration.
- It keeps the ML pipeline isolated in the backend, which is the correct place for model loading and inference.
- It keeps the UI responsive by allowing frontend actions to remain local while generation is processed on the server.

## Operational limits
This architecture works as a real sketch-to-image demo when the environment has the required Python packages and model weights. If dependencies are missing or model download is blocked, the app should fail gracefully and show an actionable message rather than spoofing a successful image.
