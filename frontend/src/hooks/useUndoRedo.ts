import { useState, useCallback, useEffect } from 'react'

interface UndoRedoState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UndoRedoActions<T> {
  set: (newPresent: T, skipHistory?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

const MAX_HISTORY_LENGTH = 50

export function useUndoRedo<T>(
  initialPresent: T,
  isEqual?: (a: T, b: T) => boolean
): [T, UndoRedoActions<T>] {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  })

  // Default equality check (deep comparison for objects)
  const checkEqual = useCallback(
    (a: T, b: T): boolean => {
      if (isEqual) return isEqual(a, b)
      return JSON.stringify(a) === JSON.stringify(b)
    },
    [isEqual]
  )

  const set = useCallback(
    (newPresent: T, skipHistory = false) => {
      setState((currentState) => {
        // Skip if the new state is the same as current
        if (checkEqual(currentState.present, newPresent)) {
          return currentState
        }

        if (skipHistory) {
          return {
            ...currentState,
            present: newPresent,
          }
        }

        // Limit history length
        const newPast = [...currentState.past, currentState.present].slice(
          -MAX_HISTORY_LENGTH
        )

        return {
          past: newPast,
          present: newPresent,
          future: [], // Clear future on new action
        }
      })
    },
    [checkEqual]
  )

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState

      const previous = currentState.past[currentState.past.length - 1]
      const newPast = currentState.past.slice(0, -1)

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState

      const next = currentState.future[0]
      const newFuture = currentState.future.slice(1)

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      }
    })
  }, [])

  const clear = useCallback(() => {
    setState((currentState) => ({
      past: [],
      present: currentState.present,
      future: [],
    }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      // Ctrl+Y for redo (Windows style)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return [
    state.present,
    {
      set,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      clear,
    },
  ]
}

// Specific type for widget history
export interface WidgetSnapshot {
  widgets: Array<{
    id: string
    name: string
    query_id?: string
    chart_type: string
    chart_config: unknown
    position: { x: number; y: number; w: number; h: number }
  }>
}

export function useWidgetHistory(initialWidgets: WidgetSnapshot['widgets']) {
  return useUndoRedo<WidgetSnapshot>(
    { widgets: initialWidgets },
    (a, b) => {
      // Compare widgets by their essential properties
      if (a.widgets.length !== b.widgets.length) return false
      return a.widgets.every((widget, i) => {
        const other = b.widgets[i]
        return (
          widget.id === other.id &&
          widget.name === other.name &&
          widget.position.x === other.position.x &&
          widget.position.y === other.position.y &&
          widget.position.w === other.position.w &&
          widget.position.h === other.position.h
        )
      })
    }
  )
}
