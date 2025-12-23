import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateId()
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }
    set((state) => ({ toasts: [...state.toasts, newToast] }))

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, newToast.duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts: () => {
    set({ toasts: [] })
  },
}))

// Convenience functions for easy usage
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'success', title, message, duration })
  },
  error: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'error', title, message, duration })
  },
  info: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'info', title, message, duration })
  },
  warning: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'warning', title, message, duration })
  },
}
