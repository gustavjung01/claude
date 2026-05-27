function WorkspacePanel({ workspace, files, selectedFile, onSelectWorkspace, onFileSelect }) {
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
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#cccccc',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Workspace
        </h2>
        
        <button
          onClick={onSelectWorkspace}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          📁 SELECT FOLDER
        </button>
      </div>

      {/* Workspace path */}
      {workspace && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#2d2d30',
          borderBottom: '1px solid #3e3e42',
          fontSize: '12px',
          color: '#858585',
          wordBreak: 'break-all'
        }}>
          {workspace}
        </div>
      )}

      {/* File tree */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0'
      }}>
        {!workspace ? (
          <div style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: '#858585',
            fontSize: '13px'
          }}>
            Select a folder to view files
          </div>
        ) : files.length === 0 ? (
          <div style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: '#858585',
            fontSize: '13px'
          }}>
            No files found
          </div>
        ) : (
          files.map((file, index) => (
            <div
              key={index}
              onClick={() => onFileSelect(file)}
              style={{
                padding: '6px 16px',
                cursor: file.type === 'file' ? 'pointer' : 'default',
                backgroundColor: selectedFile?.path === file.path ? '#094771' : 'transparent',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingLeft: `${16 + file.path.split('/').length * 12}px`
              }}
              onMouseEnter={(e) => {
                if (selectedFile?.path !== file.path) {
                  e.currentTarget.style.backgroundColor = '#2a2d2e'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFile?.path !== file.path) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>
                {file.type === 'directory' ? '📁' : '📄'}
              </span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.name}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default WorkspacePanel
