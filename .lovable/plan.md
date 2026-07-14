## Módulo de Documentos com Versionamento

Vincula documentos a projetos (a instância do CRM é por projeto), com versionamento imutável — cada nova versão vira uma linha nova, jamais sobrescreve, e todas continuam baixáveis.

## Modelo de dados

Migration cria enum `tipo_documento` (`material` | `contrato` | `aditivo` | `relatorio` | `outro`) e tabela `documentos`:

- `id` uuid PK
- `projeto_id` → `projetos(id)` (cascade)
- `grupo_documento_id` uuid — mesmo valor para todas as versões de um mesmo documento (gerado no upload inicial)
- `tipo` `tipo_documento`
- `nome_arquivo` text
- `numero_versao` int
- `storage_path` text (caminho no bucket privado)
- `tamanho_arquivo` bigint (bytes)
- `mime_type` text
- `enviado_por` uuid → `usuarios_internos`
- `descricao_da_versao` text
- `e_versao_atual` boolean
- `criado_em` timestamptz default `now()`
- índice único parcial: `(grupo_documento_id) where e_versao_atual` — garante 1 versão atual por grupo
- índice `(projeto_id, tipo, criado_em desc)`

**RLS**: `SELECT/INSERT/UPDATE/DELETE` gated por `public.projeto_no_escopo(projeto_id, auth.uid())` (função já existente). GRANTs para `authenticated` e `service_role`.

**Trigger de auditoria**: `AFTER INSERT` em `documentos` insere em `interacoes` (tipo `nota`) "Documento X — versão N enviada por <user>: <descricao>".

## Storage

Bucket privado `documentos-projetos`. Caminho: `{projeto_id}/{grupo_documento_id}/v{numero_versao}-{nome_arquivo}`.

**Políticas em `storage.objects`** (bucket = `documentos-projetos`): SELECT/INSERT/UPDATE/DELETE só se `projeto_no_escopo((storage.foldername(name))[1]::uuid, auth.uid())`. Assim quem pode ver o projeto pode ler/gravar seus arquivos.

Downloads via **signed URL** (5 min) gerado por server function.

## Server functions (`src/lib/documentos.functions.ts`)

Todas com `requireSupabaseAuth`:

- `listDocumentosByProjeto({ projeto_id })` — retorna array agrupado por `grupo_documento_id` com todas as versões ordenadas por `numero_versao desc`, junto com `enviado_por` (nome).
- `registerDocumentoVersion({ projeto_id, grupo_documento_id?, tipo, nome_arquivo, storage_path, tamanho_arquivo, mime_type, descricao_da_versao })`:
  - Se `grupo_documento_id` vazio → cria grupo novo (gera uuid, `numero_versao = 1`, `e_versao_atual = true`).
  - Se existir → dentro de uma transação (RPC Postgres `registrar_nova_versao_documento`): busca `max(numero_versao)`, marca versões anteriores `e_versao_atual = false`, insere nova com `numero_versao = max+1` e `e_versao_atual = true`. Isso evita corrida cliente-servidor.
  - Retorna a linha inserida.
- `getDocumentoDownloadUrl({ documento_id })` — resolve `storage_path` (RLS valida escopo), gera signed URL 300s.
- `deleteGrupoDocumento({ grupo_documento_id })` (só admin) — usado apenas para limpeza; **por padrão não expor no UI** (requisito é imutabilidade).

O upload do binário acontece direto no browser com o client `supabase` (bucket privado, RLS aplica ao usuário logado). Depois o front chama `registerDocumentoVersion` com os metadados. Isso evita passar o arquivo pela server function.

## UI — nova aba "Documentos" em `projetos.$id.tsx`

Adicionar `<TabsTrigger value="documentos">` e um `<TabsContent>` renderizando `<DocumentosTab projetoId={id} />` (componente novo em `src/components/documentos-tab.tsx`).

Layout do componente:

- **4 seções colapsáveis por tipo**: Materiais, Contratos, Aditivos, Relatórios, Outros. Cada seção tem seu próprio dropzone "Arrastar arquivo aqui ou clicar para selecionar" que cria um **novo grupo** (documento novo) desse tipo.
- **Lista de documentos do grupo** (cards): mostra `nome_arquivo`, badge "Versão atual v{n}" (cor `primary`), tamanho, quem enviou, data. Botão "Nova versão" abre dialog com dropzone + campo obrigatório "O que mudou nesta versão?".
- **Ver histórico**: expandível abaixo do card — lista todas as versões (mais recente no topo), cada linha com `v{n}` (badge `outline` se antiga, `default` se atual), data, autor, descrição, botão de download. Nunca esconde a versão antiga.
- **Indicador visual**: versão atual = badge verde/primary + ícone `Star`; anteriores = badge cinza + opacidade 0.8.

Validação client-side de tipo de arquivo:
- Extensões aceitas: `.pdf .doc .docx .xls .xlsx .png .jpg .jpeg .webp`
- Tamanho máximo: 25 MB (mostrar toast se exceder)
- Zod schema `documentoUploadSchema` para validar antes do upload

Drag-and-drop nativo (sem dependência nova): eventos `onDragOver / onDrop` em `div` com estado `isDragging`.

## Fluxo de upload (client)

```text
1. usuário arrasta arquivo → valida tipo/tamanho
2. (nova versão) pede descrição obrigatória em dialog; (grupo novo) pede tipo se ainda não selecionado
3. gera storage_path = `${projetoId}/${grupoId ?? novoUuid}/v${proximoN}-${nomeSanitizado}`
4. supabase.storage.from('documentos-projetos').upload(path, file)
5. chama registerDocumentoVersion(...) — server insere row e devolve versão criada
6. invalidateQueries(['documentos', projetoId])
```

Se a etapa 5 falhar, apagamos o objeto órfão via `supabase.storage.remove([path])` no `catch` para não deixar lixo no bucket.

## Arquivos criados/alterados

- **Migration**: enum + tabela + índices + RLS + policies + GRANT + trigger de auditoria + função RPC `registrar_nova_versao_documento`.
- **Storage bucket**: `documentos-projetos` (privado) via `storage_create_bucket` + policies em `storage.objects` via migration.
- **Novo**: `src/lib/documentos.functions.ts`
- **Novo**: `src/components/documentos-tab.tsx` (com subcomponentes `DocumentGroup`, `VersionHistory`, `UploadDialog`, `Dropzone`)
- **Edit**: `src/routes/_authenticated/projetos.$id.tsx` — adiciona a aba "Documentos".
- **Edit**: `src/lib/labels.tsx` — helpers `tipoDocumentoLabel`, `formatFileSize`.

## Critérios de aceite (mapeamento)

- ✅ Nova versão nunca apaga a anterior → RPC insere linha nova, `UPDATE` só troca `e_versao_atual` do resto do grupo; nenhum `DELETE` nem overwrite de storage (paths são versionados).
- ✅ Download de qualquer versão antiga → cada linha do histórico tem botão que chama `getDocumentoDownloadUrl` no `documento_id` daquela versão específica.
- ✅ Versão vigente clara → badge "Versão atual v{n}" em verde no card do grupo; histórico marca a atual em destaque e as anteriores em cinza.
