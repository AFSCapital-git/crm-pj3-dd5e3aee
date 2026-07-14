# GestorFINEP

CRM interno para consultorias que gerenciam projetos de financiamento **FINEP** para empresas clientes. Prioriza controle de prazos, marcos de entrega e trilha de auditoria de compliance.

## Stack

- **TanStack Start** (React 19 + Vite) — SSR e server functions
- **Tailwind CSS v4** + shadcn/ui
- **Lovable Cloud** (Postgres + Auth + Storage; equivalente a Supabase gerenciado)
- Deploy: **Lovable** (botão Publish)

## Funcionalidades

- **Dashboard**: valor captado (Σ valor_aprovado de projetos ativos), contadores de urgência (vencidos, ≤7d, ≤15d, ≤30d), lista de marcos vencendo e taxa de aprovação.
- **Empresas clientes** (CRUD) com consultor responsável.
- **Editais FINEP** (CRUD) com destaque para prazos abertos.
- **Projetos** com ficha completa: dados, marcos com badge de urgência, linha do tempo (interações + auditoria).
- **Cronograma consolidado**: todos os marcos filtráveis por consultor e urgência.
- **Exportação CSV** de projetos + marcos.
- **Autenticação** e-mail/senha; papéis `admin` e `consultor`; **RLS** garante que cada consultor só vê a própria carteira.

## Compliance embutido

- Marcos ganham categoria de urgência derivada em SQL (view `marcos_com_urgencia`): `vencido | critico_7 | alerta_15 | aviso_30 | ok`.
- Triggers de auditoria automáticos:
  - alteração em `valor_aprovado` → interação `aditivo_contratual`;
  - mudança em `data_submissao` / `prazo_execucao_meses` / `data_prevista` do marco → `alteracao_cronograma`;
  - mudança de `status` do projeto → nota;
  - registro de `data_entrega_real` → nota com dias de atraso ou pontualidade.
- Confirmação obrigatória (AlertDialog) ao marcar entrega, informando data real.

## Modelo de dados

- `usuarios_internos` (espelha `auth.users`), `user_roles` (separada, evita escalation)
- `empresas_clientes`, `linhas_editais_finep`, `projetos`, `marcos_entregas`, `interacoes`
- View `public.marcos_com_urgencia` (security_invoker) usada por dashboard e cronograma

## Variáveis de ambiente

Geradas automaticamente pelo Lovable Cloud — não é necessário configurar manualmente:

| Nome                            | Onde                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Browser                                                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser                                                                   |
| `VITE_SUPABASE_PROJECT_ID`      | Browser                                                                   |
| `SUPABASE_URL`                  | Server                                                                    |
| `SUPABASE_PUBLISHABLE_KEY`      | Server                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server (não usada diretamente — reservada para operações administrativas) |

## Desenvolvimento

```bash
bun install
bun run dev
```

## Deploy

Clique em **Publish** no editor do Lovable. Migrações e edge/server functions são publicadas automaticamente. Para expor a app em domínio próprio, use **Project Settings → Domains** após o primeiro publish.

## Primeiro uso

1. Acesse `/auth` e crie a primeira conta — ela vira `admin` automaticamente.
2. Cadastre consultores (eles se registram sozinhos em `/auth` e entram como `consultor`).
3. Como admin, atribua cada empresa a um consultor.
4. Cadastre editais FINEP, projetos e marcos.
5. Acompanhe pelo Dashboard e Cronograma.

## Estrutura

```
src/
├── routes/
│   ├── __root.tsx              # layout raiz, SSR, metadata
│   ├── index.tsx               # redireciona para /dashboard
│   ├── auth.tsx                # login / cadastro
│   └── _authenticated/         # subtree protegida (redirect a /auth)
│       ├── route.tsx           # sidebar + gate de sessão
│       ├── dashboard.tsx
│       ├── empresas.tsx
│       ├── editais.tsx
│       ├── projetos.index.tsx
│       ├── projetos.$id.tsx    # ficha do projeto
│       ├── cronograma.tsx
│       └── usuarios.tsx        # admin
├── lib/
│   ├── *.functions.ts          # createServerFn RPCs (auth-obrigatório via RLS)
│   └── labels.tsx              # rótulos, formatação, UrgencyBadge
├── components/
│   ├── app-sidebar.tsx
│   └── ui/                     # shadcn
└── integrations/supabase/      # gerado — não editar
```
