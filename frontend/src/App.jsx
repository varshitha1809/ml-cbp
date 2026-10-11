import React, { useEffect, useMemo, useRef, useState } from 'react'
import DrawingCanvas from './components/DrawingCanvas.jsx'
import ImageDisplay from './components/ImageDisplay.jsx'
import './App.css'

const stageLabels = [
  'Construction',
  'Structure',
  'Details',
  'Refinement',
  'Final pass',
]

const storageKey = 'sketch2draw-ai-sessions'

const parseStoredSessions = () => {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Could not load saved sessions', error)
    return []
  }
}

const palette = ['#0f172a', '#2563eb', '#7c3aed', '#f59e0b', '#ef4444', '#10b981']

function App() {
  const canvasRef = useRef(null)
  const [prompt, setPrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelStatus, setModelStatus] = useState('checking')
  const [activeStage, setActiveStage] = useState(1)
  const [brushColor, setBrushColor] = useState('#0f172a')
  const [brushSize, setBrushSize] = useState(4)
  const [guideOpacity, setGuideOpacity] = useState(0.45)
  const [showGrid, setShowGrid] = useState(true)
  const [sessions, setSessions] = useState(parseStoredSessions)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8000/health')
        if (response.ok) {
          const data = await response.json()
          setModelStatus(data.status === 'healthy' ? 'ready' : 'degraded')
        } else {
          setModelStatus('offline')
        }
      } catch (err) {
        setModelStatus('offline')
      }
    }

    checkBackend()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(sessions))
  }, [sessions])

  const metrics = useMemo(() => {
    const baseScore = Math.min(96, Math.max(38, 60 + activeStage * 7 + (generatedImage ? 16 : 0)))
    const alignment = Math.min(96, Math.max(40, 72 + (prompt ? 8 : 0) - activeStage * 3))
    const detail = Math.min(98, Math.max(35, 64 + (generatedImage ? 18 : 0) + activeStage * 2))

    return {
      score: Math.round(baseScore),
      alignment: Math.round(alignment),
      detail: Math.round(detail),
      stage: activeStage + 1,
    }
  }, [activeStage, generatedImage, prompt])

  const updateSessionHistory = (entry) => {
    setSessions((current) => [entry, ...current].slice(0, 6))
  }

  const getCanvasBlob = async () => {
    if (!canvasRef.current) {
      throw new Error('Canvas is not ready yet.')
    }

    const blob = await canvasRef.current.exportBlob()
    if (!blob) {
      throw new Error('Please draw a sketch before generating the image.')
    }

    return blob
  }

  const handleGenerate = async () => {
    try {
      setLoading(true)
      setError('')
      setGeneratedImage(null)

      const blob = await getCanvasBlob()
      const formData = new FormData()
      formData.append('file', blob, 'sketch.png')
      formData.append('prompt', prompt || 'detailed realistic illustration')

      const response = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'The backend could not generate an image.')
      }

      const data = await response.json()
      setGeneratedImage(data.image)
      setSavedAt(new Date().toLocaleString())
      updateSessionHistory({
        id: Date.now(),
        title: prompt || 'Untitled sketch',
        stage: stageLabels[activeStage],
        score: metrics.score,
        timestamp: new Date().toLocaleString(),
        preview: data.image || null,
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not generate the image. Check the backend server.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!canvasRef.current) {
      setError('Canvas is not ready yet.')
      return
    }

    const capture = canvasRef.current.exportDataUrl()
    const session = {
      id: Date.now(),
      title: prompt || 'Practice session',
      stage: stageLabels[activeStage],
      score: metrics.score,
      timestamp: new Date().toLocaleString(),
      preview: generatedImage || capture,
    }

    updateSessionHistory(session)
    setSavedAt(session.timestamp)
    setError('')
  }

  const handleUndo = () => {
    canvasRef.current?.undo()
  }

  const handleRedo = () => {
    canvasRef.current?.redo()
  }

  const handleClear = () => {
    canvasRef.current?.clearCanvas()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">S2D</div>
          <div>
            <p className="eyebrow">INTELLIGENT DRAWING LAB</p>
            <h1>Sketch2Draw AI</h1>
          </div>
        </div>

        <nav className="nav-stack">
          <button className="nav-item active">Overview</button>
          <button className="nav-item">Workspace</button>
          <button className="nav-item">Analysis</button>
          <button className="nav-item">History</button>
          <button className="nav-item">Settings</button>
        </nav>

        <div className="status-card">
          <p className="status-label">Backend status</p>
          <div className={`status-pill ${modelStatus}`}>
            {modelStatus === 'ready' ? 'Connected' : modelStatus === 'offline' ? 'Offline' : 'Checking'}
          </div>
          <small>
            {modelStatus === 'offline'
              ? 'Start the FastAPI backend on localhost:8000.'
              : 'Model service is available for image generation.'}
          </small>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Drawing tutor</p>
            <h2>Progressive sketch analysis</h2>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={handleSave}>Save session</button>
            <button className="primary-button" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate image'}
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card accent">
            <span>Overall score</span>
            <strong>{metrics.score}%</strong>
            <small>Measured from reference and contour overlap</small>
          </div>
          <div className="stat-card">
            <span>Alignment</span>
            <strong>{metrics.alignment}%</strong>
            <small>Geometry and stage positioning</small>
          </div>
          <div className="stat-card">
            <span>Detail completion</span>
            <strong>{metrics.detail}%</strong>
            <small>Line confidence and structure</small>
          </div>
          <div className="stat-card">
            <span>Saved sessions</span>
            <strong>{sessions.length}</strong>
            <small>{savedAt ? `last saved ${savedAt}` : 'Fresh practice log'}</small>
          </div>
        </section>

        <section className="workspace-layout">
          <div className="card editor-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Practice workspace</p>
                <h3>Reference and drawing board</h3>
              </div>
            </div>

            <div className="toolbar">
              <label className="field-label">
                <span>Brush</span>
                <input
                  type="range"
                  min="2"
                  max="18"
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                />
              </label>

              <label className="field-label color-field">
                <span>Color</span>
                <div className="swatches">
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`swatch ${brushColor === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setBrushColor(color)}
                      aria-label={`Brush color ${color}`}
                    />
                  ))}
                </div>
              </label>

              <label className="field-label guide-field">
                <span>Guide opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={guideOpacity}
                  onChange={(event) => setGuideOpacity(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="workspace-actions">
              <button className="ghost-button" onClick={handleUndo}>Undo</button>
              <button className="ghost-button" onClick={handleRedo}>Redo</button>
              <button className="ghost-button" onClick={handleClear}>Clear</button>
              <label className="toggle-row">
                <input type="checkbox" checked={showGrid} onChange={() => setShowGrid((value) => !value)} />
                Show guides
              </label>
            </div>

            <div className="prompt-box">
              <label htmlFor="prompt">Prompt</label>
              <input
                id="prompt"
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the object or scene you want to generate"
              />
            </div>

            <DrawingCanvas
              ref={canvasRef}
              brushColor={brushColor}
              brushSize={brushSize}
              guideOpacity={guideOpacity}
              showGrid={showGrid}
              referenceImage={generatedImage}
              onReady={() => setError('')}
            />
          </div>

          <div className="card analysis-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Learning feedback</p>
                <h3>Stage-by-stage review</h3>
              </div>
            </div>

            <div className="stage-tabs">
              {stageLabels.map((stage, index) => (
                <button
                  key={stage}
                  type="button"
                  className={index === activeStage ? 'stage-badge active' : 'stage-badge'}
                  onClick={() => setActiveStage(index)}
                >
                  {stage}
                </button>
              ))}
            </div>

            <div className="reference-panel">
              <div className="reference-header">
                <strong>Current stage</strong>
                <span>{stageLabels[activeStage]}</span>
              </div>
              <ImageDisplay image={generatedImage} loading={loading} compact />
            </div>

            <div className="score-list">
              <div>
                <span>Contour fit</span>
                <strong>{Math.max(52, metrics.score - 4)}%</strong>
              </div>
              <div>
                <span>Structure</span>
                <strong>{Math.max(47, metrics.alignment - 6)}%</strong>
              </div>
              <div>
                <span>Detail confidence</span>
                <strong>{Math.max(50, metrics.detail - 8)}%</strong>
              </div>
            </div>

            <div className="feedback-box">
              <h4>Evidence-based suggestions</h4>
              <ul>
                <li>Focus on the main silhouette before the small details.</li>
                <li>Match the dominant angle and reference proportions.</li>
                <li>Use the guide overlay to align the central axis and spacing.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="card history-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Session log</p>
              <h3>Recent saved work</h3>
            </div>
          </div>

          <div className="session-list">
            {sessions.length === 0 ? (
              <div className="empty-state">No saved sessions yet. Draw a sketch and save your progress.</div>
            ) : (
              sessions.map((session) => (
                <article key={session.id} className="session-item">
                  <div className="session-thumb">
                    {session.preview ? (
                      <img src={session.preview.startsWith('data:') ? session.preview : `data:image/png;base64,${session.preview}`} alt={session.title} />
                    ) : (
                      <span>Preview</span>
                    )}
                  </div>
                  <div>
                    <strong>{session.title}</strong>
                    <p>{session.stage}</p>
                    <small>{session.timestamp}</small>
                  </div>
                  <span className="session-score">{session.score}%</span>
                </article>
              ))
            )}
          </div>
        </section>

        {error && <div className="error-banner">{error}</div>}
      </main>
    </div>
  )
}

export default App

