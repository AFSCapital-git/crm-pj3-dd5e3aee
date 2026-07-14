## O que está acontecendo

Sua conta foi criada com sucesso, mas o Supabase Auth está exigindo **confirmação de e-mail** antes do primeiro login. Como esse é um CRM interno (uso da equipe da consultoria), a confirmação por e-mail só adiciona atrito sem valor de segurança.

## Correção

Ativar **auto-confirmação de e-mail** no backend via `configure_auth` (`auto_confirm_email: true`). Efeito:

- Contas novas ficam ativas imediatamente após "Cadastrar" — sem passar por caixa de entrada.
- Sua conta atual (`romero.junior@afbrinvestimentos.com.br`) já existe mas está com `email_confirmed_at = null`. Rodo uma migration curta que confirma manualmente todos os usuários já cadastrados (`UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL`), para você conseguir entrar agora mesmo.
- Mantenho HIBP ligado (proteção contra senhas vazadas) — só desligo a confirmação por e-mail.

## Passos

1. `configure_auth` → `auto_confirm_email: true`, `password_hibp_enabled: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`.
2. Migration: confirmar manualmente os usuários existentes em `auth.users`.
3. Você faz login normalmente em `/auth` com o e-mail e a senha já cadastrados.

Nenhum código do app muda.
