## O que está acontecendo

Não é um bug do código. A proteção **HIBP (Have I Been Pwned)** está ativa no Lovable Cloud e bloqueou a senha que você tentou usar (`12345678` ou similar) porque ela aparece em vazamentos públicos conhecidos. A mensagem vem direto do backend de autenticação.

## Como corrigir

Escolha **uma** das duas opções:

### Opção A — Usar uma senha forte (recomendado)
Simplesmente cadastre com uma senha que não seja trivial. Regras práticas:
- 12+ caracteres
- misture maiúsculas, minúsculas, números e símbolos
- não use palavras de dicionário nem sequências (`123456`, `senha123`, `qwerty`, nome da empresa, etc.)

Exemplo de padrão aceito: `Gf!n3p@2026-Romero` (não use essa exata, invente a sua).

Nenhuma alteração de código é necessária — é só cadastrar novamente com senha mais forte.

### Opção B — Desativar a verificação HIBP
Se você prefere não ter esse bloqueio (ex.: ambiente interno controlado), eu desligo a checagem chamando `configure_auth` com `password_hibp_enabled: false`. Nenhum código muda; só a configuração do backend.

Recomendo **manter ligado** (Opção A) já que é um CRM com dados de clientes e o custo é só escolher senha melhor.

## Próximo passo

Me diga qual opção você quer:
- **A** — vou apenas confirmar e você tenta de novo com senha forte;
- **B** — eu desativo a checagem HIBP agora.
