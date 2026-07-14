
# GestorFINEP — Plano de implementação

## Observação sobre stack
Você pediu Next.js + Vercel. Este projeto Lovable roda em **TanStack Start (React 19) + Tailwind v4 + Lovable Cloud (Supabase por baixo) + deploy Lovable**. A arquitetura pedida (SSR, RSC-like server functions, Postgres + RLS, auth por e-mail/senha) é totalmente equivalente — apenas troca `Next.js` por `TanStack Start` e `Vercel` por `Lovable`. Sigo com essa stack salvo instrução contrária.

---

## Fluxo de acompanhamento de prazos e alertas (para você confirmar)

### 1. Fonte da verdade
Cada `marcos_entregas` tem `data_prevista`, `data_entrega_real` (nullable) e `status` (`pendente` / `entregue` / `atrasado`). Nenhum job noturno é necessário: o status "atrasado" e as janelas 30/15/7 são **derivados por consulta** a partir de `data_prevista` vs `now()` e `data_entrega_real IS NULL`. Isso garante que o dashboard nunca fique dessincronizado.

### 2. Categorias de urgência (derivadas em uma view SQL `marcos_com_urgencia`)
- `vencido` — `data_prevista < today` e sem `data_entrega_real` → **vermelho forte, topo da lista**
- `critico_7` — vence em 0 a 7 dias → vermelho
- `alerta_15` — vence em 8 a 15 dias → laranja
- `aviso_30` — vence em 16 a 30 dias → amarelo
- `ok` — >30 dias ou já entregue → neutro

### 3. Dashboard
- Card "Marcos vencendo (30 dias)" lista marcos das 4 primeiras categorias, ordenados por `data_prevista` ascendente, com badge colorida da categoria e nome do projeto/empresa.
- Contadores no topo: nº de vencidos, nº em ≤7d, nº em ≤15d, nº em ≤30d — cada contador clicável filtra a lista.
- Um marco vencido sem entrega **sempre** aparece, independentemente da janela de 30 dias, para atender ao critério de aceite.

### 4. Marcar como entregue (fluxo)
1. Usuário clica "Marcar como entregue" no marco.
2. Modal de confirmação pede `data_entrega_real` (default = hoje) e observação opcional.
3. Server function grava `data_entrega_real`, define `status = 'entregue'`, e:
   - se `data_entrega_real > data_prevista`, adiciona à `interacoes` um registro tipo `nota` com texto "Marco entregue com X dias de atraso".
   - senão, registra "Marco entregue no prazo".
4. Trigger de auditoria (ver §5) grava a alteração automaticamente.

### 5. Trilha de auditoria automática (compliance)
Trigger Postgres `AFTER UPDATE` em `projetos` e `marcos_entregas`:
- Se `valor_aprovado` mudar em `projetos` → insere em `interacoes` tipo `aditivo contratual` com `descricao` "Valor aprovado alterado de R$ X para R$ Y por <usuário>".
- Se `prazo_execucao_meses` ou `data_submissao` mudar → tipo `alteração de cronograma`.
- Se `data_prevista` de um marco mudar → tipo `alteração de cronograma` no projeto pai.
O `usuario_id` do autor vem de `auth.uid()` via `current_setting` capturado no trigger.

### 6. Permissões (RLS)
- Enum `app_role` = `admin` | `consultor`, tabela separada `user_roles` (nunca no perfil), função `has_role(uid, role)` SECURITY DEFINER.
- Policies:
  - `empresas_clientes`: SELECT/UPDATE se `consultor_responsavel_id = auth.uid()` OU `has_role(auth.uid(),'admin')`.
  - `projetos`, `marcos_entregas`, `interacoes`: SELECT/UPDATE se o projeto pertence a empresa cuja `consultor_responsavel_id = auth.uid()` OU admin.
  - `linhas_editais_finep`: SELECT para todos autenticados; INSERT/UPDATE só admin.
  - `usuarios_internos`, `user_roles`: SELECT próprio + admin lê tudo; INSERT/UPDATE só admin.

### 7. Cronograma consolidado
Página lista todos os marcos de projetos ativos do escopo do usuário, agrupados por semana, com filtro por consultor (admin) e por status/urgência. Mesmo componente visual de badges do dashboard.

### 8. Exportação CSV
Botão em "Projetos" e em "Cronograma" gera CSV via server function (respeitando RLS), com colunas relevantes de projeto + marcos.

---

## Plano de implementação (após confirmação do fluxo acima)

### Passo 1 — Backend (Lovable Cloud)
1. Habilitar Lovable Cloud.
2. Migration 1 — schema: enums (`app_role`, `porte_empresa`, `status_empresa`, `categoria_edital`, `status_projeto`, `tipo_marco`, `status_marco`, `tipo_interacao`) + tabelas + GRANTs + RLS + policies + função `has_role`.
3. Migration 2 — triggers de auditoria + view `marcos_com_urgencia`.
4. Auth: e-mail/senha; primeiro usuário promovido a `admin` manualmente via seed.

### Passo 2 — App shell
- Layout com sidebar: Dashboard, Empresas, Editais, Projetos, Cronograma, Usuários (admin).
- Rotas protegidas sob `_authenticated/`.
- Login em `/auth`.

### Passo 3 — Telas CRUD
Empresas, Editais, Projetos (com aba Ficha contendo Dados / Marcos / Linha do tempo), Usuários (admin).

### Passo 4 — Dashboard + Cronograma consolidado
Cards, lista de urgência, taxa de aprovação, valor captado, filtros.

### Passo 5 — Exportação CSV + README
Server functions de export; README com variáveis (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) e passos de deploy no Lovable.

---

## Detalhes técnicos
- **Server functions** com `requireSupabaseAuth` para todas as leituras/escritas — RLS aplica automaticamente o escopo do consultor.
- **View `marcos_com_urgencia`** com `security_invoker=on` para herdar as policies de `marcos_entregas`.
- **Triggers de auditoria** usam `auth.uid()` diretamente (Supabase expõe no contexto da sessão).
- **Confirmação de "entregue"** via `AlertDialog` do shadcn.
- **Cores de urgência** viram tokens semânticos em `styles.css` (`--urgency-overdue`, `--urgency-critical`, `--urgency-warning`, `--urgency-notice`) — nada de `bg-red-500` hardcoded.

---

**Confirma o fluxo de prazos/alertas descrito acima?** Ao aprovar o plano, começo pela migration do schema + RLS e sigo na ordem dos passos.
