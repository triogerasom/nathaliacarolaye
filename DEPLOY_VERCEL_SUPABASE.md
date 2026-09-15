# Publicação Vercel + Supabase

## Supabase

1. Crie um projeto no Supabase.
2. Em SQL Editor, execute `supabase/schema.sql`.
3. Em Authentication > Users, crie o usuário:
   - E-mail: `eu15933220620@gmail.com`
   - Senha temporária: `456070`
4. Em Authentication > URL Configuration, adicione a URL da Vercel depois do deploy.
5. Copie:
   - Project URL
   - anon public key

## Vercel

Configure as variáveis de ambiente:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Depois publique a pasta do projeto na Vercel. O arquivo `vercel.json` já aponta para a pasta `dist`.

## Primeiro acesso

Ao entrar com `eu15933220620@gmail.com` e `456070`, a plataforma força a criação de uma nova senha. Com Supabase configurado, essa troca fica salva na autenticação do servidor.
