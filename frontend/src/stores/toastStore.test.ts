import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore, toast } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addToast', () => {
    it('should add a toast to the store', () => {
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Test Toast',
        message: 'This is a test message',
      })

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].title).toBe('Test Toast')
      expect(toasts[0].message).toBe('This is a test message')
    })

    it('should auto-remove toast after duration', () => {
      useToastStore.getState().addToast({
        type: 'info',
        title: 'Auto-remove test',
        duration: 3000,
      })

      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(3000)

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it('should not auto-remove toast when duration is 0', () => {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Persistent toast',
        duration: 0,
      })

      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(10000)

      expect(useToastStore.getState().toasts).toHaveLength(1)
    })

    it('should use default duration of 5000ms', () => {
      useToastStore.getState().addToast({
        type: 'warning',
        title: 'Default duration',
      })

      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(5000)

      vi.advanceTimersByTime(4999)
      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('removeToast', () => {
    it('should remove a specific toast by id', () => {
      useToastStore.getState().addToast({ type: 'success', title: 'Toast 1' })
      useToastStore.getState().addToast({ type: 'error', title: 'Toast 2' })

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(2)

      useToastStore.getState().removeToast(toasts[0].id)

      expect(useToastStore.getState().toasts).toHaveLength(1)
      expect(useToastStore.getState().toasts[0].title).toBe('Toast 2')
    })
  })

  describe('clearToasts', () => {
    it('should remove all toasts', () => {
      useToastStore.getState().addToast({ type: 'success', title: 'Toast 1' })
      useToastStore.getState().addToast({ type: 'error', title: 'Toast 2' })
      useToastStore.getState().addToast({ type: 'info', title: 'Toast 3' })

      expect(useToastStore.getState().toasts).toHaveLength(3)

      useToastStore.getState().clearToasts()

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('convenience functions', () => {
    it('toast.success should add a success toast', () => {
      toast.success('Success!', 'It worked')

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].title).toBe('Success!')
      expect(toasts[0].message).toBe('It worked')
    })

    it('toast.error should add an error toast', () => {
      toast.error('Error!', 'Something went wrong')

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('error')
    })

    it('toast.info should add an info toast', () => {
      toast.info('Info')

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('info')
    })

    it('toast.warning should add a warning toast', () => {
      toast.warning('Warning', 'Be careful', 10000)

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('warning')
      expect(toasts[0].duration).toBe(10000)
    })
  })
})
