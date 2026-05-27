import { useState, useRef, useEffect } from 'react'

function TerminalPanel({ workspace, fileContent, selectedFile }) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('terminal') // 'terminal' or 'preview'
  const outputRef = useRef(null)
  const commandRef = useRef(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onCommandOutput((data) => {
        setOutput(prev => prev + data.data)
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
      })
    }
    // Auto focus CMD textarea on mount
    if (commandRef.current) {
      commandRef.current.focus()
    }
  }, [])

  const handleRunCommand = async () => {
    if (!command.trim() || !workspace) return
    
    setIsRunning(true)
    setOutput(`Running: ${command}\n${'='.repeat(50)}\n`)
    
    if (window.electronAPI) {
      const result = await window.electronAPI.runCommand(workspace, command)
      setOutput(prev => prev + `\n${'='.repeat(50)}\nExit code: ${result.exitCode}\n`)
      setIsRunning(false)
    }
  }

  const handleStopCommand = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopCommand()
      setIsRunning(false)
      setOutput(prev => prev + '\n[Command stopped by user]\n')
    }
  }

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(output)
  }

  const handleClear = () => {
    setOutput('')
  }

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      handleRunCommand()
    }
  }

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#cccccc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42'
      }}>
        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'terminal' ? '#1e1e1e' : 'transparent',
            color: activeTab === 'terminal' ? '#cccccc' : '#858585',
            border: 'none',
            borderBottom: activeTab === 'terminal' ? '2px solid #007acc' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          💻 Terminal
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'preview' ? '#1e1e1e' : 'transparent',
            color: activeTab === 'preview' ? '#cccccc' : '#858585',
            border: 'none',
            borderBottom: activeTab === 'preview' ? '2px solid #007acc' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          👁 Preview
        </button>
      </div>

      {/* Content */}
      {activeTab === 'terminal' ? (
        <>
          {/* Command input */}
          <div style={{
            padding: '16px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3e3e42'
          }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#cccccc',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              💻 CMD COMMAND
            </label>
            <textarea
              ref={commandRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập lệnh CMD ở đây, ví dụ: dir, node -v, git status --short&#10;(Ctrl+Enter để chạy)"
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                backgroundColor: '#3c3c3c',
                color: '#cccccc',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Consolas, "Courier New", monospace',
                resize: 'vertical',
                marginBottom: '12px'
              }}
            />
            
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={handleRunCommand}
                disabled={isRunning || !command.trim()}
                style={{
                  padding: '14px 28px',
                  backgroundColor: isRunning ? '#3c3c3c' : '#0e639c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                ▶ RUN CMD
              </button>
              
              <button
                onClick={handleStopCommand}
                disabled={!isRunning}
                style={{
                  padding: '14px 20px',
                  backgroundColor: isRunning ? '#c72e2e' : '#3c3c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isRunning ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ⬛ STOP
              </button>
              
              <button
                onClick={handleCopyOutput}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#3c3c3c',
                  color: '#cccccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                📋 COPY CMD OUTPUT
              </button>
              
              <button
                onClick={handleClear}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#3c3c3c',
                  color: '#cccccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                🗑 CLEAR CMD OUTPUT
              </button>
            </div>
          </div>

          {/* Output */}
          <div
            ref={outputRef}
            style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              backgroundColor: '#0c0c0c',
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {output || 'Ready to run commands...'}
          </div>
        </>
      ) : (
        /* Preview tab */
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          backgroundColor: '#1e1e1e'
        }}>
          {selectedFile ? (
            <>
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#2d2d30',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '13px',
                color: '#cccccc'
              }}>
                📄 {selectedFile.path}
              </div>
              <pre style={{
                margin: 0,
                padding: '12px',
                backgroundColor: '#252526',
                borderRadius: '4px',
                fontFamily: 'Consolas, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                overflowX: 'auto',
                color: '#d4d4d4'
              }}>
                {fileContent || 'No content'}
              </pre>
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#858585',
              padding: '40px',
              fontSize: '14px'
            }}>
              Select a file from the workspace to preview
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TerminalPanel
