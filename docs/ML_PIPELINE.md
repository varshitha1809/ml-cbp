# ML Pipeline Notes

## Current model pipeline
The backend is configured to use a ControlNet + Stable Diffusion flow:
- Base model: `runwayml/stable-diffusion-v1-5`
- ControlNet: `lllyasviel/control_v11p_sd15_scribble`
- Edge preprocessing: `lllyasviel/Annotators` with HED preprocessing

## Realities of the current implementation
This is a legitimate inference pathway when the environment has the required GPU and packages available. The code does not fabricate model outputs.

## Key constraints
- Large model weights must be downloaded from Hugging Face
- Apple Silicon users may benefit from MPS; other systems will fall back to CPU
- Performance is highly dependent on available VRAM and model cache state
- No custom training pipeline is currently present in the repository

## Value of the existing design
Even without a custom training loop, the repository has a valid inference foundation that can be extended into a learning-tutor application by combining image processing, stage guidance, and drawing evaluation.
