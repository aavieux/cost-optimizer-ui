export type LoginResponse = {
  token: string
  expires_at: string
  moderator: {
    id: number
    username: string
  }
}

export type MeResponse = {
  id: number
  username: string
  assigned_customers: number[]
  created_at: string
}
