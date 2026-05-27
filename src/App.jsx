import { useState, useEffect } from 'react'
import WorkspacePanel from './components/WorkspacePanel'
import TerminalPanel from './components/TerminalPanel'
import PromptPanel from './components/PromptPanel'

function App() {
  const [workspace, setWorkspace] = useState(null)
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')

  useEffect(() => {
    if (workspace) {
      loadFiles()
    }
  }, [workspace])

  const loadFiles = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.listWorkspaceFiles(workspace)
    if (result.files) {
      setFiles(result.files)
    }
  }

  const handleSelectWorkspace = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectWorkspace()
    if (path) {
      setWorkspace(path)
    }
  }

  const handleFileSelect = async (file) => {
    if (!window.electronAPI || file.type !== 'file') return
    setSelectedFile(file)
    const fullPath = `${workspace}/${file.path}`
    const result = await window.electronAPI.readWorkspaceFile(fullPath)
    if (result.content) {
      setFileContent(result.content)
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr 320px',
      height: '100vh',
      gap: '1px',
      backgroundColor: '#1e1e1e'
    }}>
      <WorkspacePanel
        workspace={workspace}
        files={files}
        selectedFile={selectedFile}
        onSelectWorkspace={handleSelectWorkspace}
        onFileSelect={handleFileSelect}
      />
      
      <TerminalPanel
        workspace={workspace}
        fileContent={fileContent}
        selectedFile={selectedFile}
      />
      
      <PromptPanel
        workspace={workspace}
      />
    </div>
  )
}

export default App
