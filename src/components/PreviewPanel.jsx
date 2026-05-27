function PreviewPanel({ selectedFile, fileContent }) {
  return (
    <div style={{
      backgroundColor: '#252526',
      color: '#cccccc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: '#cccccc',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          File Preview
        </h2>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: '#1e1e1e'
      }}>
        {selectedFile ? (
          <>
            <div style={{
              padding: '10px 14px',
              marginBottom: '12px',
              borderRadius: '4px',
              backgroundColor: '#303336',
              color: '#d4d4d4',
              fontSize: '13px',
              wordBreak: 'break-all'
            }}>
              📄 {selectedFile.path}
            </div>
            <pre style={{
              margin: 0,
              padding: '14px',
              backgroundColor: '#181818',
              borderRadius: '6px',
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              overflowX: 'auto',
              color: '#e5e5e5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {fileContent || 'File is empty or could not be loaded.'}
            </pre>
          </>
        ) : (
          <div style={{
            color: '#858585',
            fontSize: '14px',
            padding: '32px',
            textAlign: 'center'
          }}>
            Select a file from the workspace to preview its contents.
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPanel
