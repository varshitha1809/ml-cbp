# API Reference

## Health and status
### `GET /`
Returns a small readiness message.

### `GET /health`
Returns the current server health state and GPU status when available.

Example response:
```json
{
  "status": "healthy",
  "gpu_available": true,
  "gpu_type": "MPS (Metal)",
  "endpoints_active": true
}
```

### `GET /models/status`
Returns whether the model pipeline is loaded.

## Generation endpoint
### `POST /generate`
Accepts a multipart form upload with:
- `file`: image file
- `prompt`: optional text prompt

Example cURL:
```powershell
curl -X POST "http://localhost:8000/generate" -F "file=@sketch.png" -F "prompt=studio portrait" 
```

Example response:
```json
{
  "success": true,
  "image": "base64-encoded-png",
  "prompt": "studio portrait",
  "generation_time": 12.45,
  "image_size": [512, 512],
  "message": "Image generated successfully"
}
```

## Error handling
The API responds with HTTP 400 for invalid uploads and HTTP 500 for generation failures. The service should never silently swap a real failure for a fake success image.
