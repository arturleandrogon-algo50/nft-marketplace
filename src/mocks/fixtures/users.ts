import type { StoredUser } from '../db'

// Usuários de teste (as senhas estão no README). Aqui só existe o hash:
// PBKDF2-SHA256, 100 mil iterações, com o salt de cada usuário.
// Dois usuários, para testar que os dados de um não aparecem para o outro.
export const seedUsers: StoredUser[] = [
  {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana@nftmarket.test',
    salt: 'seed-ana',
    passwordHash: 'a4ddb0fa52aabba3eb7b295127bfaee93101daedaf065138712df18d92c1a47f',
  },
  {
    id: 'user-2',
    name: 'Bruno Lima',
    email: 'bruno@nftmarket.test',
    salt: 'seed-bruno',
    passwordHash: 'bbdf5f2a38368430b8146e2fba64fd7e8228102d4dde7520775f8fe2a993cec6',
  },
]
