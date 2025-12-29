import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2, AlertCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { checkAuthWithCookie } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const status = searchParams.get('status')

    if (status === 'pending') {
      setIsPending(true)
      return
    }

    if (status === 'disabled') {
      setError('Your account has been disabled. Please contact an administrator.')
      return
    }

    if (status === 'success') {
      // Token is in HTTP-only cookie, call /api/auth/me to verify and get user info
      checkAuthWithCookie()
        .then((success) => {
          if (success) {
            navigate('/query')
          } else {
            setError('Authentication failed. Please try again.')
          }
        })
        .catch(() => {
          setError('Authentication failed. Please try again.')
        })
      return
    }

    // Unknown status or no status - redirect to login
    navigate('/login')
  }, [searchParams, checkAuthWithCookie, navigate])

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Account Pending Approval</AlertTitle>
            <AlertDescription>
              Your account has been created and is waiting for administrator approval.
              You will be able to log in once an administrator approves your account.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}
