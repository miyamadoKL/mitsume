import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setToken(token).then(() => {
        navigate('/query')
      })
    } else {
      navigate('/login')
    }
  }, [searchParams, setToken, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}
