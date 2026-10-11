import React from 'react'
import './ImageDisplay.css'

function ImageDisplay({ image, loading, compact = false }) {
  if (loading) {
    return (
      <div className={compact ? 'image-display compact' : 'image-display'}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">✨ AI is generating your image...</p>
          <p className="loading-subtext">This may take 10-30 seconds</p>
        </div>
      </div>
    )
  }

  if (image) {
    return (
      <div className={compact ? 'image-display compact' : 'image-display'}>
        <img
          src={`data:image/png;base64,${image}`}
          alt="AI Generated"
          className="generated-image"
        />
      </div>
    )
  }

  return (
    <div className={compact ? 'image-display compact' : 'image-display'}>
      <div className="placeholder-container">
        <div className="placeholder-icon">🎨</div>
        <p className="placeholder-text">Your generated image will appear here</p>
        <p className="placeholder-subtext">Draw something and click "Generate Image" to start!</p>
      </div>
    </div>
  )
}

export default ImageDisplay

