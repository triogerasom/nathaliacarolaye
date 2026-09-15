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

## Atualização automática do Supabase

O GitHub Actions já tem um workflow em `.github/workflows/supabase-sync.yml`.

Para ativar:

1. Entre no GitHub.
2. Abra o repositório `triogerasom/nathaliacarolaye`.
3. Vá em **Settings > Secrets and variables > Actions**.
4. Clique em **New repository secret**.
5. Crie o segredo:
   - Nome: `SUPABASE_DB_URL`
   - Valor: connection string do banco Supabase.

A connection string fica no Supabase em **Project Settings > Database > Connection string**.
Use o modo **URI** e substitua `[YOUR-PASSWORD]` pela senha do banco.

Depois disso, sempre que você alterar arquivos em `supabase/*.sql`, o GitHub vai aplicar a atualização no banco automaticamente.

## Primeiro acesso

Ao entrar com `eu15933220620@gmail.com` e `456070`, a plataforma força a criação de uma nova senha. Com Supabase configurado, essa troca fica salva na autenticação do servidor.
