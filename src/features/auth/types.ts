// Dados públicos do usuário. O hash da senha nunca sai do "servidor".
export interface User {
  id: string
  name: string
  email: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

// Resposta de login e cadastro: o token da sessão e quem está logado.
export interface AuthResponse {
  token: string
  user: User
}
