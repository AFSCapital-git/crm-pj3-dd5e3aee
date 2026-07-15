## Módulo de Administração de Usuários, Permissões e Convites

Antes do código, aqui está o **fluxo completo de convite** e o plano de implementação. Confirme o fluxo (ou peça ajustes) antes de eu partir para a build.

---

### Fluxo de convite (ponta a ponta)

**1. Envio (admin autenticado)**
- Admin abre `/admin/usuarios` → aba "Convites" → "Convidar usuário".
- Preenche e-mail + papel (`admin` ou `consultor`) + nome opcional.
- Server function `criarConvite` (com `requireSupabaseAuth` + checagem `is_admin`):
  - Valida e-mail, verifica que não existe usuário ativo com esse e-mail nem convite pendente ativo.
  - Gera `token_unico` = 32 bytes aleatórios em base64url (via `crypto.randomBytes`).
  - Armazena **apenas o hash SHA-256** do token na coluna `token_hash` (o token cru nunca fica no banco).
  - Insere em `convites`: `status='pendente'`, `data_expiracao = now() + 7 days`, `convidado_por = auth.uid()`.
  - Chama helper de e-mail transacional (Lovable Emails / Resend, conforme domínio já configurado) com link `https://<app>/aceitar-convite?token=<token_cru>`.
  - Insere linha em `log_auditoria_admin` (acao='convite_enviado').

**2. Aceite (destinatário, não autenticado)**
- Rota pública `/aceitar-convite` (top-level, SSR desligado, sem gate).
- Loader/server fn `validarConvite({ token })`:
  - Recalcula `sha256(token)`, procura em `convites` por `token_hash = X` **e** `status='pendente'` **e** `data_expiracao > now()`.
  - Se não encontra → tela "Convite inválido, expirado ou já utilizado".
  - Se encontra → exibe formulário: mostra e-mail (readonly), papel, campos "nome completo" e "senha" (+ confirmação, com política HIBP já ativa).
- Ao submeter, server fn `aceitarConvite({ token, nome, senha })`:
  - Revalida convite (mesma checagem, dentro de uma transação lógica).
  - `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } })`.
  - O trigger existente `handle_new_user` cria a linha em `usuarios_internos`; a função de aceite então:
    - Ajusta `status='ativo'`, `convidado_por = convite.convidado_por` em `usuarios_internos`.
    - Remove a role padrão inserida pelo trigger e insere `papel_designado` do convite em `user_roles`.
    - Marca `convites.status='aceito'`, grava `aceito_em` e `usuario_criado_id`.
    - Grava `log_auditoria_admin` (acao='convite_aceito').
  - Retorna sucesso → tela pede para o usuário fazer login em `/auth`.

**3. Reenvio**
- Admin clica "Reenviar" num convite pendente.
- Server fn `reenviarConvite`: gera **novo token**, atualiza `token_hash` + `data_expiracao = now()+7d`, mantém `status='pendente'`. Link antigo deixa de funcionar automaticamente (o hash mudou). Envia novo e-mail. Loga `convite_reenviado`.

**4. Revogação**
- Admin clica "Revogar". Server fn seta `status='revogado'`. Loga `convite_revogado`. Tentativas futuras de aceitar retornam "inválido".

**5. Expiração automática**
- Job `pg_cron` diário: `UPDATE convites SET status='expirado' WHERE status='pendente' AND data_expiracao < now()`.
- Complementar: a checagem `data_expiracao > now()` no `validarConvite` já bloqueia em tempo real mesmo antes do cron rodar.

**Garantias de segurança do fluxo**
- Token só existe em texto claro no e-mail e na URL; o banco só guarda hash.
- Admin nunca vê nem define senha alheia.
- Reenvio invalida o link anterior (hash trocou).
- Convite revogado/expirado nunca mais aceita, mesmo com o link salvo.
- RLS na tabela `convites` impede leitura por não-admins; aceite público usa server fn com `supabaseAdmin` após validar o token.

---

### Plano de implementação

**A. Migração de banco**
1. `usuarios_internos`: adicionar `status text` (`convidado|ativo|desativado`, default `ativo` para os já existentes), `ultimo_login timestamptz`, `convidado_por uuid REFERENCES usuarios_internos(id)`.
2. `convites`: `id, email_convidado citext, papel_designado app_role, token_hash text UNIQUE, data_expiracao timestamptz, status text CHECK IN (…), convidado_por, aceito_em, usuario_criado_id, criado_em, updated_at`.
3. `log_auditoria_admin`: `id, usuario_que_executou, acao text, usuario_afetado, detalhes_da_acao jsonb, data_hora`. Sem UPDATE/DELETE policies — append-only. Revogar UPDATE/DELETE de `authenticated` e `service_role` do jeito documentado (policies só de INSERT+SELECT; deletes/updates só via superuser).
4. GRANTs corretos (SELECT/INSERT para authenticated conforme necessário; nenhum acesso a `anon`).
5. RLS: só admin lê/escreve `convites` e `log_auditoria_admin`; `usuarios_internos` mantém regras atuais + admin pode alterar status/role.
6. Trigger `handle_new_user`: ajustar para respeitar convite quando existir (não forçar admin no primeiro user se estiver aceitando convite; manter fallback atual).
7. Função `pode_desativar_admin(_id)` que retorna false se seria o último admin ativo; usar em trigger `BEFORE UPDATE`/`BEFORE DELETE` em `user_roles` e em `usuarios_internos.status`.
8. Trigger que atualiza `ultimo_login` (via server fn no sign-in, já que Supabase não expõe trigger de login — atualização feita no root `onAuthStateChange` chamando server fn `registrarLogin`).
9. Cron diário para expirar convites (`pg_cron` + SQL puro — Opção 1 do knowledge, sem endpoint externo).

**B. Server functions (`src/lib/admin.functions.ts`)**
- `criarConvite`, `reenviarConvite`, `revogarConvite`, `listarConvites`.
- `validarConvite` (pública, sem auth) e `aceitarConvite` (pública, usa `supabaseAdmin` só após validar hash).
- `alterarPapel`, `setUsuarioStatus` (com bloqueio "último admin"), `listarLogAuditoria`.
- `registrarLogin` (autenticada, seta `ultimo_login`).
- Todas as ações admin gravam `log_auditoria_admin` no mesmo handler.

**C. E-mail transacional**
- Verificar se domínio já está configurado (`email_domain--check_email_domain_status`). Se não, uso o scaffold de templates transacionais e sigo o setup autônomo. Template "Convite GestorFINEP" com link + validade.

**D. Rotas / UI**
- `/aceitar-convite` (pública): valida token, formulário de nome + senha, tela de sucesso/erro.
- `/_authenticated/admin/usuarios` (renomeia a atual `/usuarios`, gate por role admin no `beforeLoad` além do RLS): abas **Usuários**, **Convites pendentes**, **Log de auditoria**.
  - Usuários: tabela com busca, filtro por papel/status, último login; clique abre drawer com editar papel, ativar/desativar, histórico daquele usuário.
  - Convites: lista pendentes com reenviar/revogar; botão "Convidar usuário".
  - Log: lista cronológica com filtro por usuário/ação.
- Reaproveitar o dialog de reatribuição de carteira já existente ao desativar.
- Menu lateral: item "Administração" só para admin (já existe padrão), aponta pra nova rota.

**E. Sessão encerrada ao desativar**
- Server fn `setUsuarioStatus` quando desativa: chama `supabaseAdmin.auth.admin.signOut(userId, 'global')` para revogar refresh tokens.
- No cliente, o root `onAuthStateChange` já trata `SIGNED_OUT` e redireciona para `/auth`; adicional: hook global que a cada N minutos (ou em foco) chama `getCurrentUser` — se retornar `status='desativado'`, força signOut local imediato.

**F. Métricas do dashboard**
- Ajustar contagens de "usuários ativos" para filtrar `status='ativo'` (convidados não contam).

**G. Critérios de aceite (checklist final)**
- Token revogado/expirado → aceite retorna erro sem criar usuário.
- Tentativa de remover role admin do último admin → erro 400 do trigger.
- Toda ação admin aparece no log; UPDATE/DELETE no log falha por policy.
- Desativação → sessão do alvo termina em ≤ 1 refresh de token / próxima chamada autenticada.
- Acesso direto à URL `/admin/usuarios` sem role admin → redirect + RLS bloqueia queries mesmo se contornar UI.

<<<<<<< HEAD
Validação client-side de tipo de arquivo:

- Extensões aceitas: `.pdf .doc .docx .xls .xlsx .png .jpg .jpeg .webp`
- Tamanho máximo: 25 MB (mostrar toast se exceder)
- Zod schema `documentoUploadSchema` para validar antes do upload
=======
---
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de

**Confirma o fluxo de convite acima?** Em especial:
1. **7 dias** de validade OK, ou prefere outro prazo?
2. Papéis no convite continuam sendo só `admin`/`consultor` (os já existentes no enum), certo?
3. E-mail transacional: uso **Lovable Emails** (recomendado, já integrado à plataforma) se o domínio de e-mail estiver configurado no workspace — ok?