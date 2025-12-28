import React, { useCallback, useMemo, useRef, useEffect } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute?: () => void
  onEditorReady?: (editor: editor.IStandaloneCodeEditor) => void
  height?: string
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  onEditorReady,
  height = '300px',
}) => {
  // Use ref to always reference the latest onExecute callback
  // This avoids stale closure issues with Monaco's addCommand
  const onExecuteRef = useRef(onExecute)
  useEffect(() => {
    onExecuteRef.current = onExecute
  }, [onExecute])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    // Ctrl+Enter / Cmd+Enter to execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecuteRef.current?.()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadEnter, () => {
      onExecuteRef.current?.()
    })

    // Pass editor instance to parent
    onEditorReady?.(editor)
  }, [onEditorReady])

  const options = useMemo(() => ({
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on' as const,
    editContext: false,
  }), [])

  return (
    <div className="rounded-lg border overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="sql"
        theme="vs"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorMount}
        options={options}
      />
    </div>
  )
}
