-- ============================================================
-- Adicionar campos de endereço na tabela empresas_clientes
-- ============================================================

ALTER TABLE public.empresas_clientes ADD COLUMN cep TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN rua TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN numero TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN complemento TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN bairro TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN cidade TEXT;
ALTER TABLE public.empresas_clientes ADD COLUMN estado TEXT;

-- Índice para buscar por CEP (útil para relatórios por região)
CREATE INDEX idx_empresas_clientes_cep ON public.empresas_clientes(cep);

-- Comentários de documentação
COMMENT ON COLUMN public.empresas_clientes.cep IS 'CEP no formato 00000-000';
COMMENT ON COLUMN public.empresas_clientes.rua IS 'Nome da rua/avenida/logradouro';
COMMENT ON COLUMN public.empresas_clientes.numero IS 'Número da edificação';
COMMENT ON COLUMN public.empresas_clientes.complemento IS 'Complemento do endereço (apto, sala, etc)';
COMMENT ON COLUMN public.empresas_clientes.bairro IS 'Bairro';
COMMENT ON COLUMN public.empresas_clientes.cidade IS 'Cidade';
COMMENT ON COLUMN public.empresas_clientes.estado IS 'Estado (UF) em formato de 2 letras';
