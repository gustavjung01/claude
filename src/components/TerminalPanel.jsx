import { useState, useRef, useEffect } from 'react'

function TerminalPanel({ workspace }) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef(null)
  const commandRef = useRef(null)

  useEffect(() => {
    if (!window.electronAPI) return

    const handleOutput = (data) => {
      setOutput((prev) => prev + data.data)
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight
      }
    }

    window.electronAPI.onCmdOutput(handleOutput)

    if (commandRef.current) {
      commandRef.current.focus()
    }
  }, [])

  const dangerousCommand = (value) => {
    const triggers = ['git push', 'deploy', 'rm -rf', 'del /s', 'format', 'type .env', 'cat .env']
    const lower = value.toLowerCase()
    return triggers.some((trigger) => lower.includes(trigger))
  }

  const handleRunCommand = async () => {
    if (!command.trim()) return

    if (dangerousCommand(command) && !window.confirm('Command looks potentially destructive. Continue?')) {
      return
    }

    setIsRunning(true)
    setOutput(`Running: ${command}\n${'='.repeat(60)}\n`)

    if (window.electronAPI) {
      const result = await window.electronAPI.runCmd({ cwd: workspace, command })
      setOutput((prev) => prev + `\n${'='.repeat(60)}\nExit code: ${result.exitCode}\n`)
      setIsRunning(false)
    }
  }

  const handleStopCommand = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.stopCmd()
    setIsRunning(false)
    setOutput((prev) => prev + '\n[Command stopped by user]\n')
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
          CMD COMMAND
        </label>
        <textarea
          ref={commandRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập lệnh CMD ở đây, ví dụ: dir, node -v, git status --short"
          style={{
            width: '100%',
            minHeight: '130px',
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRunCommand}
            disabled={isRunning || !command.trim()}
            style={{
              padding: '14px 28px',
              backgroundColor: isRunning ? '#3c3c3c' : '#0e639c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '700'
            }}
          >
            ▶ RUN CMD
          </button>
          <button
            onClick={handleStopCommand}
            disabled={!isRunning}
            style={{
              padding: '14px 22px',
              backgroundColor: isRunning ? '#c72e2e' : '#3c3c3c',
              color: '#ffffff',
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
            📋 COPY OUTPUT
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
            🗑 CLEAR OUTPUT
          </button>
        </div>
      </div>
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
    </div>
  )
}

export default TerminalPanel
