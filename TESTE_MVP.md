# 🧪 Teste MVP — GestorFINEP

**Data**: 2026-07-16  
**Versão**: v0.1 (Estrutura básica)  
**Status**: Em execução

---

## 📋 Plano de Testes

### ✅ Teste 1: Signup e Login
- [ ] Acessar http://localhost:8083/auth
- [ ] Criar conta com e-mail + senha
- [ ] Verificar se redirecionou para /dashboard
- [ ] Fazer logout
- [ ] Fazer login com credenciais criadas
- [ ] **Esperado**: Login funcionar corretamente

---

### 📊 Teste 2: Dashboard
- [ ] Logar na conta
- [ ] Verificar Dashboard com métricas
- [ ] Conferir se aparecem:
  - Valor Captado
  - Total de Projetos
  - Taxa de Aprovação
  - Marcos com urgência
- [ ] **Esperado**: Dashboard carrega corretamente

---

### 🏢 Teste 3: Empresas (CRUD)
- [ ] Navegar para aba **Empresas**
- [ ] [ ] **CREATE**: Clicar "Adicionar Empresa"
  - Preencher: Razão Social, CNPJ, Email, Telefone
  - Clicar "Salvar"
  - Verificar se empresa aparece na lista
- [ ] **READ**: Conferir se lista de empresas carrega
- [ ] **UPDATE**: Clicar em uma empresa, editar dado, salvar
- [ ] **DELETE**: Clicar "Excluir", confirmar (deve soft-delete)
- [ ] **Esperado**: CRUD completo funcionando

---

### 📁 Teste 4: Editais (Read-only)
- [ ] Navegar para aba **Editais**
- [ ] Verificar lista de editais do banco
- [ ] Clicar em um edital para ver detalhes
- [ ] **Esperado**: Lista carrega, detalhes aparecem

---

### 📈 Teste 5: Projetos (CRUD)
- [ ] Navegar para aba **Projetos**
- [ ] [ ] **CREATE**: Clicar "Novo Projeto"
  - Selecionar empresa (de Teste 3)
  - Preencher: Nome, Status (em_elaboracao), Valor
  - Clicar "Salvar"
- [ ] **READ**: Conferir se projeto aparece na lista
- [ ] **UPDATE**: Clicar em projeto, mudar status para "submetido", salvar
  - ⚠️ **Nota**: Mudar para "aprovado" deveria disparar e-mail (Resend não configurado - saltar)
- [ ] **Timeline**: Clicar em projeto, verificar aba "Timeline/Interações"
- [ ] **Esperado**: CRUD funciona, timeline carrega

---

### 🎯 Teste 6: Marcos (CRUD)
- [ ] Dentro de um projeto, criar novo Marco
  - Preencher: Tipo, Data Prevista, Responsável
  - Clicar "Salvar"
  - ⚠️ **Nota**: Se atribuir responsável, deveria enviar e-mail (Resend não configurado - saltar)
- [ ] Verificar se marco aparece na lista
- [ ] Editar marco, mudar status para "entregue"
- [ ] Verificar urgência calculada (cor verde/amarela/vermelha)
- [ ] **Esperado**: Marcos CRUD funciona, urgência recalcula

---

### 👥 Teste 7: Usuários e Convites (Admin-only)
- [ ] Logar com **conta admin** (usar primeira conta criada)
- [ ] Navegar para aba **Usuários**
- [ ] [ ] **Convites**:
  - Clicar "Convidar novo usuário"
  - Preencher: Email, Nome, Papel (consultor)
  - Clicar "Gerar convite"
  - ⚠️ **Nota**: E-mail não vai chegar (Resend não configurado), mas convite é salvo no banco
- [ ] [ ] **Aceitar Convite** (sem Resend):
  - Abrir link de convite manualmente (copiar do banco de dados)
  - URL: `/aceitar-convite?token=...`
  - Preencher: Nome, Senha (min 8 chars)
  - Clicar "Aceitar"
  - Verificar se novo usuário foi criado em auth.users
- [ ] [ ] **Status de Usuários**:
  - Desativar um usuário (botão "Desativar")
  - Verificar se ele fica com status "Inativo"
  - Tentar logar com conta desativada → deve falhar (global signOut)
- [ ] **Esperado**: Convites funcionam, aceitação cria user, desativação é global

---

### 🔐 Teste 8: RLS (Row-Level Security)
- [ ] Criar **2 contas** diferentes (consultor1, consultor2)
- [ ] Consultor1 cria uma empresa
- [ ] Consultor2 tenta visualizar a empresa de Consultor1
  - Via `/empresas` → deve ver só suas empresas
  - Via API direto → RLS deve bloquear
- [ ] Admin consegue ver todas as empresas
- [ ] [ ] Teste de projects:
  - Consultor1 cria projeto vinculado a empresa dele
  - Consultor2 tenta listar projetos → não vê projeto de Consultor1
- [ ] **Esperado**: RLS funciona, consultor só vê seus dados, admin vê tudo

---

## 📝 Notas Importantes

- **Resend não está configurado**: Pule testes de e-mail (Teste 2 Password Reset, Teste 4 Convites com link). Configuraremos depois.
- **Credenciais de teste**: Use e-mails com `+teste` do Gmail para não sujar inbox (ex: `seu-email+teste@gmail.com`)
- **Soft Delete**: Deletar empresa/projeto não remove do banco, só marca como inativo (conferir com status='inativo' ou deleted_at IS NOT NULL)
- **RLS Enforcement**: Testado via banco de dados — consultor nunca consegue ver dados de outro via WHERE ou JOIN

---

## ✅ Resultados

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Signup/Login | ⏳ | Em execução |
| 2. Dashboard | ⏳ | Em execução |
| 3. Empresas CRUD | ⏳ | Em execução |
| 4. Editais | ⏳ | Pendente |
| 5. Projetos CRUD | ⏳ | Pendente |
| 6. Marcos CRUD | ⏳ | Pendente |
| 7. Usuários/Convites | ⏳ | Pendente |
| 8. RLS | ⏳ | Pendente |

---

## 🚀 Como rodar

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Testes (quando implementarmos)
npm test
```

**App**: http://localhost:8083
