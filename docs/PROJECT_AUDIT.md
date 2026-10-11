# Project Audit

## Overview
This repository is a compact full-stack sketch-to-image prototype that combines a React frontend and a FastAPI backend. The app is designed to let a user draw a rough sketch in the browser, send it to the backend, and receive a generated image using Stable Diffusion with ControlNet.

## Current repository structure
- `frontend/` – Vite + React app
- `backend/` – FastAPI API and model runner
- `README.md` – high-level product documentation
- `LICENSE` – standard MIT license

## Technology stack
### Frontend
- React 18 with Vite
- HTML5 canvas for drawing input
- Inline CSS and component CSS for styling
- Fetch API for API communication

### Backend
- FastAPI
- Pillow for image processing
- PyTorch and Hugging Face diffusers for model inference
- `controlnet_aux` HED-based preprocessing

## Existing functionality
The app already supports:
- drawing on a canvas
- exporting the canvas as a PNG
- uploading the sketch to `/generate`
- running a simple FastAPI image-generation flow
- returning a base64-encoded generated image to the frontend
- displaying the generated result in the browser

## Working vs incomplete features
### Working
- Canvas drawing and clear behavior
- Frontend-backend request submission when the backend is live
- PRE-generated image response flow through base64 JSON
- Initial health endpoint and basic model-status route

### Incomplete or environment-sensitive
- Real Stable Diffusion inference requires GPU or compatible runtime support and model downloads
- The repo assumes Apple Silicon/MPS optimization in the documentation, but the code does not enforce a real hardware check beyond a best-effort MPS detection
- There is no persistent database or session model yet
- There is no robust evaluation engine or drawing analytics module
- The UI is functional but not yet a full Sketch2Draw AI learning experience

## Existing ML capabilities
The backend currently attempts to use:
- `runwayml/stable-diffusion-v1-5`
- `lllyasviel/control_v11p_sd15_scribble`
- `lllyasviel/Annotators` via HED

This is a real model pipeline if the dependencies are installed and the required weights are available. The project does not currently include training scripts, dataset packaging, or validation metrics for a custom model.

## Database and API design
At present there is no database layer. The API surface is minimal and centered on:
- `GET /` – basic status
- `GET /health` – GPU and health check
- `POST /generate` – sketch upload plus optional prompt
- `GET /models/status` – pipeline loaded state

The backend accepts an uploaded image and returns a success payload that includes:
- `success`
- `image`
- `prompt`
- `generation_time`
- `image_size`
- `message`

## Setup notes
The repository expects:
1. Python dependencies from `backend/requirements.txt`
2. A frontend install with `npm install` in `frontend/`
3. Starting the backend with `uvicorn app:app --reload --host 0.0.0.0 --port 8000`
4. Starting the frontend with `npm run dev`

## Identified issues
- The build baseline currently fails until frontend dependencies are installed
- The repo has no automated tests yet
- Model loading is heavy and may fail without GPU or cache availability
- There is no explicit data validation or request-size guard beyond a basic file-type check
- The app does not yet implement stage-based tutoring, session persistence, or real evaluation metrics

## Enhancement opportunities
- Add a modern multi-panel dashboard UI with a drawing workspace and learning tools
- Provide stage-based practice workflows and guide overlays
- Evaluate drawing similarity using actual image-comparison metrics
- Persist user sessions locally in the browser without adding an unnecessary backend DB
- Document environment-dependent limitations honestly

## Risks and compatibility constraints
- Large model downloads can exceed disk and memory limits
- GPU acceleration depends on hardware, OS, and package compatibility
- Frontend and backend must remain loosely coupled to preserve the working demo flow
- The project should avoid fabricating AI metrics, model performance, or training results
