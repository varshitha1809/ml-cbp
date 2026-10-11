# Testing and Validation

## Frontend checks
Run:
```powershell
cd C:\Users\Laxmi\Downloads\sketch-to-image-ai-main\sketch-to-image-ai-main\frontend
npm install
npm run build
```

This validates the React and Vite build path.

## Backend checks
When dependencies are available:
```powershell
cd C:\Users\Laxmi\Downloads\sketch-to-image-ai-main\sketch-to-image-ai-main\backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Then confirm the endpoint with a browser visit to:
- http://localhost:8000/docs
- http://localhost:8000/health

## Current state
- Frontend build validation is the primary automated check available in this environment
- Real model inference tests require GPU, model downloads, and compatible Python packages
- No repository test suite was present before the UI upgrade, so the check is intentionally minimal and honest
