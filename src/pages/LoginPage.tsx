import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api'
import type { LoginResponse } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Logo from '@/assets/logo.svg?react'

const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(64, 'Username must be 64 characters or fewer')
    .refine((v) => !/[\x00-\x1F\x7F]/.test(v), 'Username contains invalid characters')
    .transform((v) => v.trim()),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be 128 characters or fewer')
    .refine((v) => !/[\x00-\x1F\x7F]/.test(v), 'Password contains invalid characters'),
})

type LoginForm = z.infer<typeof loginSchema>

const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  VALIDATION_FAILED: 'Please fill in all fields.',
  DB_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setApiError(null)
    try {
      const res = await api.post<LoginResponse>('/auth/login', data)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('expires_at', res.data.expires_at)
      localStorage.setItem('username', res.data.moderator.username)
      navigate('/')
    } catch (err: unknown) {
      resetField('password')
      const code =
        err &&
        typeof err === 'object' &&
        'response' in err
          ? (err as { response?: { data?: { error?: { code?: string } } } })
              .response?.data?.error?.code ?? ''
          : ''
      setApiError(API_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-10">

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-28 w-auto" aria-label="Cloud Zenith" />
          <span className="text-xl font-bold tracking-[0.28em] uppercase text-neutral-900">
            Cloud Zenith
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs tracking-wide text-neutral-500 uppercase">
              Username
            </Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              maxLength={64}
              {...register('username')}
              aria-invalid={!!errors.username}
              className="border-neutral-200 focus-visible:ring-0 focus-visible:border-neutral-900 transition-colors rounded-lg"
            />
            {errors.username && (
              <p className="text-xs text-red-500">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs tracking-wide text-neutral-500 uppercase">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={128}
                {...register('password')}
                aria-invalid={!!errors.password}
                className="border-neutral-200 focus-visible:ring-0 focus-visible:border-neutral-900 transition-colors rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-700 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {apiError && (
            <p className="text-xs text-red-500" role="alert">
              {apiError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-neutral-900 text-white hover:bg-neutral-700 transition-colors rounded-lg"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

      </div>
    </div>
  )
}
