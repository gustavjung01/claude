import { useState } from 'react'

function PromptPanel({ workspace }) {
  // Config state
  const [baseUrl, setBaseUrl] = useState('https://unlimited.aiprimetech.io')
  const [token, setToken] = useState('')
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [maxTokens, setMaxTokens] = useState(4096)
  
  // Prompt state
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Options
  const [includeHistory, setIncludeHistory] = useState(false)
  const [includeSelectedFile, setIncludeSelectedFile] = useState(false)
  
  // Token tracking
  const [tokenUsage, setTokenUsage] = useState({
    input: 0,
    output: 0,
    cacheCreate: 0,
    cacheRead: 0,
    requests: 0
  })

  const handleLoadModels = async () => {
    if (!token.trim()) {
      alert('Please enter your API token first')
      return
    }

    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Extract model IDs from response
      let modelList = []
      if (data.data && Array.isArray(data.data)) {
        modelList = data.data.map(m => m.id || m.name || m)
      } else if (Array.isArray(data)) {
        modelList = data.map(m => m.id || m.name || m)
      }

      if (modelList.length === 0) {
        // Fallback to default models
        modelList = [
          'claude-haiku-4-5-20251001',
          'claude-3-7-sonnet-20250219',
          'claude-3-5-sonnet-20241022'
        ]
      }

      setModels(modelList)
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0])
      }
    } catch (error) {
      // Fallback to default models on error
      const fallbackModels = [
        'claude-haiku-4-5-20251001',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022'
      ]
      setModels(fallbackModels)
      if (!selectedModel) {
        setSelectedModel(fallbackModels[0])
      }
      alert(`Failed to load models: ${error.message}\n\nUsing fallback models instead.`)
    }
  }

  const handleSend = async () => {
    if (!token.trim()) {
      alert('Please enter your API token')
      return
    }
    if (!prompt.trim()) {
      alert('Please enter a prompt')
      return
    }
    if (!selectedModel) {
      alert('Please select a model')
      return
    }

    const promptToSend = prompt
    setPrompt('') // Clear prompt immediately after send
    setIsLoading(true)
    setResponse('')

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: promptToSend
            }
          ]
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Extract response text
      let responseText = ''
      if (data.content && Array.isArray(data.content)) {
        responseText = data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n')
      }

      setResponse(responseText)

      // Update token usage
      if (data.usage) {
        setTokenUsage(prev => ({
          input: prev.input + (data.usage.input_tokens || 0),
          output: prev.output + (data.usage.output_tokens || 0),
          cacheCreate: prev.cacheCreate + (data.usage.cache_creation_input_tokens || 0),
          cacheRead: prev.cacheRead + (data.usage.cache_read_input_tokens || 0),
          requests: prev.requests + 1
        }))
      }

      // Auto-clear prompt after successful send
      setPrompt('')

    } catch (error) {
      setResponse(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyReply = () => {
    if (response) {
      navigator.clipboard.writeText(response)
    }
  }

  const handleCopyTranscript = () => {
    const transcript = `User: ${prompt}\n\nAssistant: ${response}`
    navigator.clipboard.writeText(transcript)
  }

  return (
    <div style={{
      backgroundColor: '#252526',
      color: '#cccccc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #3e3e42',
        backgroundColor: '#2d2d30'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: '#cccccc',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Claude Assistant (Optional)
        </h2>
      </div>

      {/* Config Section */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #3e3e42',
        backgroundColor: '#2d2d30'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            API Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your API token"
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
        </div>

        <button
          onClick={handleLoadModels}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px'
          }}
        >
          🔄 LOAD MODELS
        </button>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            {models.length === 0 ? (
              <option value="">Load models first</option>
            ) : (
              models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            Max Output Tokens
          </label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
            min="100"
            max="100000"
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
        </div>

        {/* Token Usage */}
        <div style={{
          padding: '8px',
          backgroundColor: '#1e1e1e',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#858585'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <div>Input: <span style={{ color: '#4ec9b0' }}>{tokenUsage.input}</span></div>
            <div>Output: <span style={{ color: '#4ec9b0' }}>{tokenUsage.output}</span></div>
            <div>Cache Create: <span style={{ color: '#4ec9b0' }}>{tokenUsage.cacheCreate}</span></div>
            <div>Cache Read: <span style={{ color: '#4ec9b0' }}>{tokenUsage.cacheRead}</span></div>
          </div>
          <div style={{ marginTop: '4px', textAlign: 'center' }}>
            Requests: <span style={{ color: '#4ec9b0' }}>{tokenUsage.requests}</span>
          </div>
        </div>
      </div>

      {/* Prompt Section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '12px 16px'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            style={{
              width: '100%',
              height: '120px',
              padding: '8px',
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Options */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
            />
            Include history
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeSelectedFile}
              onChange={(e) => setIncludeSelectedFile(e.target.checked)}
            />
            Include selected file
          </label>
        </div>

        <button
          onClick={handleSend}
          disabled={isLoading}
          style={{
            padding: '12px',
            backgroundColor: isLoading ? '#3c3c3c' : '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '12px'
          }}
        >
          {isLoading ? '⏳ SENDING...' : '🚀 SEND'}
        </button>

        {/* Response */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#858585', marginBottom: '4px' }}>
            Response
          </label>
          <div style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#1e1e1e',
            border: '1px solid #3e3e42',
            borderRadius: '4px',
            overflowY: 'auto',
            fontSize: '13px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: '150px',
            maxHeight: '300px'
          }}>
            {response || 'Response will appear here...'}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={handleCopyReply}
            disabled={!response}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: response ? '#3c3c3c' : '#2d2d30',
              color: response ? '#cccccc' : '#858585',
              border: 'none',
              borderRadius: '4px',
              cursor: response ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            📋 Copy Reply
          </button>
          <button
            onClick={handleCopyTranscript}
            disabled={!response}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: response ? '#3c3c3c' : '#2d2d30',
              color: response ? '#cccccc' : '#858585',
              border: 'none',
              borderRadius: '4px',
              cursor: response ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            📋 Copy Transcript
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromptPanel
