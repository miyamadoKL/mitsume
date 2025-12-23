import React from 'react'
import Editor from '@monaco-editor/react'

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute?: () => void
  height?: string
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  height = '300px',
}) => {
  const handleEditorMount = (editor: unknown) => {
    const monacoEditor = editor as { addCommand: (keyCode: number, handler: () => void) => void }
    // Ctrl+Enter / Cmd+Enter to execute
    monacoEditor.addCommand(2048 | 3, () => { // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter
      onExecute?.()
    })
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="sql"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          theme: 'vs-dark',
        }}
      />
    </div>
  )
}
