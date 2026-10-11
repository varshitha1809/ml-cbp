import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './DrawingCanvas.css'

const CANVAS_SIZE = 640

const DrawingCanvas = forwardRef(function DrawingCanvas(
  { brushColor = '#0f172a', brushSize = 4, guideOpacity = 0.45, showGrid = true, referenceImage = null, onReady = null },
  ref,
) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [context, setContext] = useState(null)
  const [strokes, setStrokes] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const currentStrokeRef = useRef(null)

  const drawGrid = (ctx) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
    ctx.lineWidth = 1

    for (let x = 0; x <= CANVAS_SIZE; x += 32) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_SIZE)
      ctx.stroke()
    }

    for (let y = 0; y <= CANVAS_SIZE; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_SIZE, y)
      ctx.stroke()
    }

    ctx.restore()
  }

  const renderCanvas = (nextStrokes = strokes) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    if (showGrid) {
      drawGrid(ctx)
    }

    if (referenceImage) {
      const img = new Image()
      img.onload = () => {
        ctx.save()
        ctx.globalAlpha = guideOpacity
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.restore()
      }
      img.src = `data:image/png;base64,${referenceImage}`
    }

    nextStrokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = stroke.color
      ctx.stroke()
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    const ctx = canvas.getContext('2d')
    setContext(ctx)
    renderCanvas()

    if (onReady) {
      onReady(canvas)
    }
  }, [])

  useEffect(() => {
    renderCanvas(strokes)
  }, [showGrid, referenceImage, guideOpacity, strokes])

  useImperativeHandle(ref, () => ({
    exportBlob: () => new Promise((resolve) => {
      if (!canvasRef.current) {
        resolve(null)
        return
      }

      canvasRef.current.toBlob((blob) => resolve(blob), 'image/png')
    }),
    exportDataUrl: () => canvasRef.current?.toDataURL('image/png') || null,
    clearCanvas: () => {
      setStrokes([])
      setRedoStack([])
      renderCanvas([])
    },
    undo: () => {
      setStrokes((current) => {
        if (current.length === 0) return current
        const next = current.slice(0, -1)
        setRedoStack((redo) => [...redo, current[current.length - 1]])
        renderCanvas(next)
        return next
      })
    },
    redo: () => {
      setRedoStack((current) => {
        if (current.length === 0) return current
        const restored = current[current.length - 1]
        setStrokes((existing) => {
          const next = [...existing, restored]
          renderCanvas(next)
          return next
        })

        return current.slice(0, -1)
      })
    },
  }))

  const pointFromEvent = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const beginStroke = (event) => {
    if (!context) return

    const point = pointFromEvent(event)
    const stroke = {
      color: brushColor,
      size: brushSize,
      points: [point],
    }

    currentStrokeRef.current = stroke
    setRedoStack([])
    setIsDrawing(true)
  }

  const moveStroke = (event) => {
    if (!isDrawing || !currentStrokeRef.current) return

    const point = pointFromEvent(event)
    const nextStroke = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, point],
    }

    currentStrokeRef.current = nextStroke
    setStrokes((current) => {
      if (current.length === 0) {
        return [nextStroke]
      }

      const updated = [...current]
      updated[current.length - 1] = nextStroke
      return updated
    })
  }

  const endStroke = () => {
    if (!currentStrokeRef.current) {
      setIsDrawing(false)
      return
    }

    setStrokes((current) => {
      if (current.length === 0) {
        return [currentStrokeRef.current]
      }
      const updated = [...current]
      updated[current.length - 1] = currentStrokeRef.current
      return updated
    })

    setIsDrawing(false)
    currentStrokeRef.current = null
  }

  return (
    <div className="drawing-canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onPointerDown={beginStroke}
        onPointerMove={moveStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
      />
    </div>
  )
})

export default DrawingCanvas

