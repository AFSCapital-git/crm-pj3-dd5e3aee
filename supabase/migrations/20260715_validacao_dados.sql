-- Validações: tamanho de arquivo, duplicatas no catálogo, CNPJ único

-- 1. Validar tamanho máximo de arquivo (25 MB = 26843545 bytes)
-- Nota: Validação primária no código (documentos.functions.ts),
-- isto é um constraint de backup no banco
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_tamanho_maximo
    CHECK (tamanho_arquivo <= 26843545); -- 25 MB em bytes

-- 2. UNIQUE constraint em linhas de edital (nome + categoria)
-- Previne dois editais com mesmo nome na mesma categoria
ALTER TABLE public.linhas_editais_finep
  ADD CONSTRAINT linhas_edital_nome_categoria_uniq
    UNIQUE (nome, categoria);

-- 3. Garantir que CNPJ é apenas dígitos (14 dígitos)
-- Constraint no banco como backup da validação no código
ALTER TABLE public.empresas_clientes
  ADD CONSTRAINT empresas_cnpj_format
    CHECK (cnpj ~ '^\d{14}$'); -- Regex: exatamente 14 dígitos
