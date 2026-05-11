import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response.data?.error?.code
      // Don't redirect if we're already on the login flow
      if (code !== 'INVALID_CREDENTIALS') {
        localStorage.removeItem('token')
        localStorage.removeItem('expires_at')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function getErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })
    ?.response?.data?.error?.code
}

export default api
