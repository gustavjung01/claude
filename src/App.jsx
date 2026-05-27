import { useState, useEffect } from 'react'
import WorkspacePanel from './components/WorkspacePanel'
import TerminalPanel from './components/TerminalPanel'
import PreviewPanel from './components/PreviewPanel'

function App() {
  const [workspace, setWorkspace] = useState(null)
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')

  useEffect(() => {
    if (workspace) {
      loadFiles()
      setSelectedFile(null)
      setFileContent('')
    }
  }, [workspace])

  const loadFiles = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.listFiles(workspace)
    if (result.ok) {
      setFiles(result.files)
    } else {
      setFiles([])
    }
  }

  const handleSelectWorkspace = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setWorkspace(path)
    }
  }

  const handleFileSelect = async (file) => {
    if (!window.electronAPI || file.type !== 'file' || !workspace) return
    setSelectedFile(file)
    const result = await window.electronAPI.readFile({ folder: workspace, rel: file.path })
    if (result.ok) {
      setFileContent(result.content)
    } else {
      setFileContent(result.error || 'Unable to load file')
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr 360px',
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
      <TerminalPanel workspace={workspace} />
      <PreviewPanel selectedFile={selectedFile} fileContent={fileContent} />
    </div>
  )
}

export default App
