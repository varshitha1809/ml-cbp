"""
Model Handler for Sketch-to-Image Generation
Handles loading and inference of Stable Diffusion + ControlNet models
"""

import torch
from PIL import Image
import numpy as np
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from controlnet_aux import HEDdetector
import os
from pathlib import Path

# Global variable to store loaded pipeline
pipeline = None
preprocessor = None


def load_model():
    """
    Load Stable Diffusion + ControlNet pipeline.
    First call downloads models (~5GB) and takes 5-10 minutes.
    Subsequent calls return cached pipeline instantly.
    
    Returns:
        StableDiffusionControlNetPipeline: Loaded pipeline ready for inference
    """
    global pipeline, preprocessor
    
    # Return cached pipeline if already loaded
    if pipeline is not None:
        print("✓ Using cached model pipeline")
        return pipeline
    
    print("Loading models for the first time...")
    print("This will download ~5GB of data and take 5-10 minutes.")
    
    # Check if MPS (Metal Performance Shaders) is available on M3 Mac
    if torch.backends.mps.is_available():
        device = "mps"
        print("✓ MPS (Metal GPU) detected - using M3 acceleration")
    else:
        device = "cpu"
        print("⚠ MPS not available - falling back to CPU (will be slower)")
    
    try:
        # Load ControlNet model for sketch/scribble guidance
        print("Loading ControlNet model...")
        controlnet = ControlNetModel.from_pretrained(
            "lllyasviel/control_v11p_sd15_scribble",
            torch_dtype=torch.float16 if device == "mps" else torch.float32,
        )
        
        # Load Stable Diffusion pipeline with ControlNet
        print("Loading Stable Diffusion model...")
        pipeline = StableDiffusionControlNetPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            controlnet=controlnet,
            torch_dtype=torch.float16 if device == "mps" else torch.float32,
            safety_checker=None,  # Disable safety checker for faster inference
        )
        
        # Move pipeline to device (MPS or CPU)
        pipeline = pipeline.to(device)
        
        # Load HED preprocessor for sketch edge detection
        print("Loading sketch preprocessor...")
        preprocessor = HEDdetector.from_pretrained("lllyasviel/Annotators")
        
        print("✓ All models loaded successfully!")
        return pipeline
        
    except Exception as e:
        print(f"✗ Error loading models: {e}")
        raise


def preprocess_sketch(image_input):
    """
    Preprocess sketch image to format expected by ControlNet.
    
    Args:
        image_input (str or PIL.Image): Path to image file or PIL Image object
        
    Returns:
        PIL.Image: Preprocessed sketch image (512x512, edge-detected)
    """
    global preprocessor
    
    # Load preprocessor if not already loaded
    if preprocessor is None:
        print("Loading sketch preprocessor...")
        preprocessor = HEDdetector.from_pretrained("lllyasviel/Annotators")
    
    # Load image if path is provided
    if isinstance(image_input, str):
        image = Image.open(image_input)
    else:
        image = image_input
    
    # Convert to RGB (in case it's RGBA or grayscale)
    image = image.convert("RGB")
    
    # Resize to 512x512 (Stable Diffusion's standard size)
    image = image.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Apply HED edge detection to extract sketch structure
    # This converts your drawing into a format ControlNet understands
    control_image = preprocessor(image, scribble=True)
    
    return control_image


def generate_image(sketch_image, prompt="", num_inference_steps=20, guidance_scale=7.5):
    """
    Generate realistic image from sketch using Stable Diffusion + ControlNet.
    This is the main function that transforms your sketch into a photo.
    
    Args:
        sketch_image (str or PIL.Image): Input sketch (path or PIL Image)
        prompt (str, optional): Text guidance (e.g., "realistic photo, detailed, high quality")
        num_inference_steps (int, optional): Number of denoising steps (more = better quality but slower)
        guidance_scale (float, optional): How closely to follow the sketch (7-9 recommended)
        
    Returns:
        PIL.Image: Generated realistic image
    """
    global pipeline
    
    # Load model if not already loaded
    if pipeline is None:
        print("Model not loaded. Loading now...")
        load_model()
    
    print("Preprocessing sketch...")
    # Preprocess the sketch
    control_image = preprocess_sketch(sketch_image)
    
    # Set default prompt if none provided
    if not prompt:
        prompt = "high quality, detailed, realistic"
    
    # Negative prompt - things we don't want in the image
    negative_prompt = "low quality, blurry, distorted, deformed, ugly, bad anatomy"
    
    print(f"Generating image with prompt: '{prompt}'")
    print(f"Using {num_inference_steps} inference steps...")
    
    try:
        # Generate image
        result = pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=control_image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            controlnet_conditioning_scale=1.0,  # How much to follow the sketch
        )
        
        # Extract the generated image
        generated_image = result.images[0]
        
        print("✓ Image generated successfully!")
        return generated_image
        
    except Exception as e:
        print(f"✗ Error during generation: {e}")
        raise


def save_image(image, output_path):
    """
    Save PIL Image to file.
    
    Args:
        image (PIL.Image): Image to save
        output_path (str): Path where to save the image
    """
    # Create directory if it doesn't exist
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Save image
    image.save(output_path)
    print(f"✓ Image saved to: {output_path}")


def test_generation():
    """
    Test function to verify model loading and generation work.
    Creates a simple test sketch and generates an image.
    Run this file directly to test: python model_handler.py
    """
    import time
    
    print("="*60)
    print("SKETCH-TO-IMAGE MODEL TEST")
    print("="*60)
    
    # Create a simple test sketch (white canvas with black lines)
    print("\n1. Creating test sketch...")
    test_sketch = Image.new('RGB', (512, 512), color='white')
    pixels = test_sketch.load()
    
    # Draw a simple circle (simulate a sketch)
    for angle in range(0, 360, 2):
        x = int(256 + 100 * np.cos(np.radians(angle)))
        y = int(256 + 100 * np.sin(np.radians(angle)))
        for i in range(-3, 4):
            for j in range(-3, 4):
                if 0 <= x+i < 512 and 0 <= y+j < 512:
                    pixels[x+i, y+j] = (0, 0, 0)
    
    # Save test sketch
    test_sketch_path = "test_sketch.png"
    test_sketch.save(test_sketch_path)
    print(f"✓ Test sketch saved to: {test_sketch_path}")
    
    # Load model
    print("\n2. Loading AI models...")
    start_load = time.time()
    load_model()
    load_time = time.time() - start_load
    print(f"✓ Models loaded in {load_time:.2f} seconds")
    
    # Generate image
    print("\n3. Generating image from sketch...")
    start_gen = time.time()
    generated = generate_image(
        test_sketch,
        prompt="a beautiful circle, artistic, detailed",
        num_inference_steps=20
    )
    gen_time = time.time() - start_gen
    print(f"✓ Image generated in {gen_time:.2f} seconds")
    
    # Save result
    print("\n4. Saving generated image...")
    output_path = "test_output.png"
    save_image(generated, output_path)
    
    print("\n" + "="*60)
    print("TEST COMPLETED SUCCESSFULLY! ✓")
    print("="*60)
    print(f"\nCheck these files:")
    print(f"  - Input sketch: {test_sketch_path}")
    print(f"  - Generated output: {output_path}")
    print(f"\nPerformance:")
    print(f"  - Model load time: {load_time:.2f}s")
    print(f"  - Generation time: {gen_time:.2f}s")
    print("\n✓ Your M3 Mac setup is working correctly!")


# If this file is run directly, execute test
if __name__ == "__main__":
    test_generation()

