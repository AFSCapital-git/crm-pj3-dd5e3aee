export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      convites: {
        Row: {
          aceito_em: string | null
          convidado_por: string | null
          criado_em: string
          data_expiracao: string
          email_convidado: string
          id: string
          nome_sugerido: string | null
          papel_designado: Database["public"]["Enums"]["app_role"]
          status: string
          token_hash: string
          updated_at: string
          usuario_criado_id: string | null
        }
        Insert: {
          aceito_em?: string | null
          convidado_por?: string | null
          criado_em?: string
          data_expiracao: string
          email_convidado: string
          id?: string
          nome_sugerido?: string | null
          papel_designado: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash: string
          updated_at?: string
          usuario_criado_id?: string | null
        }
        Update: {
          aceito_em?: string | null
          convidado_por?: string | null
          criado_em?: string
          data_expiracao?: string
          email_convidado?: string
          id?: string
          nome_sugerido?: string | null
          papel_designado?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash?: string
          updated_at?: string
          usuario_criado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_usuario_criado_id_fkey"
            columns: ["usuario_criado_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      discussao_mensagens: {
        Row: {
          autor_id: string | null
          created_at: string
          editado_em: string | null
          id: string
          mensagem: string
          projeto_id: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          editado_em?: string | null
          id?: string
          mensagem: string
          projeto_id: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          editado_em?: string | null
          id?: string
          mensagem?: string
          projeto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussao_mensagens_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussao_mensagens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          criado_em: string
          descricao_da_versao: string
          e_versao_atual: boolean
          empresa_cliente_id: string | null
          enviado_por: string | null
          grupo_documento_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          numero_versao: number
          projeto_id: string | null
          storage_path: string
          tamanho_arquivo: number
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          criado_em?: string
          descricao_da_versao?: string
          e_versao_atual?: boolean
          empresa_cliente_id?: string | null
          enviado_por?: string | null
          grupo_documento_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          numero_versao: number
          projeto_id?: string | null
          storage_path: string
          tamanho_arquivo: number
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          criado_em?: string
          descricao_da_versao?: string
          e_versao_atual?: boolean
          empresa_cliente_id?: string | null
          enviado_por?: string | null
          grupo_documento_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          numero_versao?: number
          projeto_id?: string | null
          storage_path?: string
          tamanho_arquivo?: number
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: [
          {
            foreignKeyName: "documentos_empresa_cliente_id_fkey"
            columns: ["empresa_cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_nao_vinculados: {
        Row: {
          anexos_referenciados: Json
          assunto: string | null
          corpo_texto: string | null
          criado_em: string
          data_email_original: string | null
          dedup_hash: string
          id: string
          message_id: string | null
          motivo: string
          remetente_original: string
          resolvido: boolean
        }
        Insert: {
          anexos_referenciados?: Json
          assunto?: string | null
          corpo_texto?: string | null
          criado_em?: string
          data_email_original?: string | null
          dedup_hash: string
          id?: string
          message_id?: string | null
          motivo?: string
          remetente_original: string
          resolvido?: boolean
        }
        Update: {
          anexos_referenciados?: Json
          assunto?: string | null
          corpo_texto?: string | null
          criado_em?: string
          data_email_original?: string | null
          dedup_hash?: string
          id?: string
          message_id?: string | null
          motivo?: string
          remetente_original?: string
          resolvido?: boolean
        }
        Relationships: []
      }
      emails_vinculados: {
        Row: {
          anexos_referenciados: Json
          assunto: string | null
          corpo_texto: string | null
          criado_em: string
          data_email_original: string | null
          dedup_hash: string
          id: string
          message_id: string | null
          projeto_id: string
          remetente_original: string
        }
        Insert: {
          anexos_referenciados?: Json
          assunto?: string | null
          corpo_texto?: string | null
          criado_em?: string
          data_email_original?: string | null
          dedup_hash: string
          id?: string
          message_id?: string | null
          projeto_id: string
          remetente_original: string
        }
        Update: {
          anexos_referenciados?: Json
          assunto?: string | null
          corpo_texto?: string | null
          criado_em?: string
          data_email_original?: string | null
          dedup_hash?: string
          id?: string
          message_id?: string | null
          projeto_id?: string
          remetente_original?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_vinculados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          complemento: string | null
          consultor_responsavel_id: string | null
          contato_responsavel: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          numero: string | null
          porte: Database["public"]["Enums"]["porte_empresa"]
          razao_social: string
          rua: string | null
          setor_atuacao: string | null
          status: Database["public"]["Enums"]["status_empresa"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          complemento?: string | null
          consultor_responsavel_id?: string | null
          contato_responsavel?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          numero?: string | null
          porte: Database["public"]["Enums"]["porte_empresa"]
          razao_social: string
          rua?: string | null
          setor_atuacao?: string | null
          status?: Database["public"]["Enums"]["status_empresa"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          complemento?: string | null
          consultor_responsavel_id?: string | null
          contato_responsavel?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          numero?: string | null
          porte?: Database["public"]["Enums"]["porte_empresa"]
          razao_social?: string
          rua?: string | null
          setor_atuacao?: string | null
          status?: Database["public"]["Enums"]["status_empresa"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_clientes_consultor_responsavel_id_fkey"
            columns: ["consultor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_ia: {
        Row: {
          aprovado: boolean
          conteudo_gerado: string
          created_at: string
          gerado_em: string
          gerado_por: string | null
          id: string
          input_resumo: Json | null
          modelo: string | null
          projeto_id: string | null
          revisado_em: string | null
          revisado_por: string | null
          revisado_por_humano: boolean
          tipo: Database["public"]["Enums"]["tipo_insight_ia"]
          titulo: string | null
          updated_at: string
        }
        Insert: {
          aprovado?: boolean
          conteudo_gerado: string
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          input_resumo?: Json | null
          modelo?: string | null
          projeto_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_humano?: boolean
          tipo: Database["public"]["Enums"]["tipo_insight_ia"]
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          aprovado?: boolean
          conteudo_gerado?: string
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          input_resumo?: Json | null
          modelo?: string | null
          projeto_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_humano?: boolean
          tipo?: Database["public"]["Enums"]["tipo_insight_ia"]
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_ia_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_ia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_ia_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes: {
        Row: {
          created_at: string
          data_hora: string
          descricao: string
          id: string
          projeto_id: string
          tipo: Database["public"]["Enums"]["tipo_interacao"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          data_hora?: string
          descricao: string
          id?: string
          projeto_id: string
          tipo: Database["public"]["Enums"]["tipo_interacao"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          data_hora?: string
          descricao?: string
          id?: string
          projeto_id?: string
          tipo?: Database["public"]["Enums"]["tipo_interacao"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      linhas_editais_finep: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_edital"]
          created_at: string
          id: string
          nome: string
          orgao: string | null
          prazo_submissao: string | null
          requisitos_elegibilidade: string | null
          updated_at: string
          valor_maximo_edital: number | null
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["categoria_edital"]
          created_at?: string
          id?: string
          nome: string
          orgao?: string | null
          prazo_submissao?: string | null
          requisitos_elegibilidade?: string | null
          updated_at?: string
          valor_maximo_edital?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_edital"]
          created_at?: string
          id?: string
          nome?: string
          orgao?: string | null
          prazo_submissao?: string | null
          requisitos_elegibilidade?: string | null
          updated_at?: string
          valor_maximo_edital?: number | null
        }
        Relationships: []
      }
      log_auditoria_admin: {
        Row: {
          acao: string
          convite_id: string | null
          data_hora: string
          detalhes_da_acao: Json
          id: string
          usuario_afetado: string | null
          usuario_que_executou: string | null
        }
        Insert: {
          acao: string
          convite_id?: string | null
          data_hora?: string
          detalhes_da_acao?: Json
          id?: string
          usuario_afetado?: string | null
          usuario_que_executou?: string | null
        }
        Update: {
          acao?: string
          convite_id?: string | null
          data_hora?: string
          detalhes_da_acao?: Json
          id?: string
          usuario_afetado?: string | null
          usuario_que_executou?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_auditoria_admin_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "convites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auditoria_admin_usuario_afetado_fkey"
            columns: ["usuario_afetado"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auditoria_admin_usuario_que_executou_fkey"
            columns: ["usuario_que_executou"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      marcos_entregas: {
        Row: {
          created_at: string
          data_entrega_real: string | null
          data_prevista: string
          descricao: string | null
          id: string
          projeto_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_marco"]
          tipo: Database["public"]["Enums"]["tipo_marco"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrega_real?: string | null
          data_prevista: string
          descricao?: string | null
          id?: string
          projeto_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_marco"]
          tipo: Database["public"]["Enums"]["tipo_marco"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrega_real?: string | null
          data_prevista?: string
          descricao?: string | null
          id?: string
          projeto_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_marco"]
          tipo?: Database["public"]["Enums"]["tipo_marco"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marcos_entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_entregas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          area_tecnologica: string | null
          codigo_rastreio: string
          created_at: string
          data_submissao: string | null
          empresa_cliente_id: string
          id: string
          linha_edital_id: string | null
          nome_projeto: string
          prazo_execucao_meses: number | null
          status: Database["public"]["Enums"]["status_projeto"]
          updated_at: string
          valor_aprovado: number | null
          valor_solicitado: number | null
        }
        Insert: {
          area_tecnologica?: string | null
          codigo_rastreio: string
          created_at?: string
          data_submissao?: string | null
          empresa_cliente_id: string
          id?: string
          linha_edital_id?: string | null
          nome_projeto: string
          prazo_execucao_meses?: number | null
          status?: Database["public"]["Enums"]["status_projeto"]
          updated_at?: string
          valor_aprovado?: number | null
          valor_solicitado?: number | null
        }
        Update: {
          area_tecnologica?: string | null
          codigo_rastreio?: string
          created_at?: string
          data_submissao?: string | null
          empresa_cliente_id?: string
          id?: string
          linha_edital_id?: string | null
          nome_projeto?: string
          prazo_execucao_meses?: number | null
          status?: Database["public"]["Enums"]["status_projeto"]
          updated_at?: string
          valor_aprovado?: number | null
          valor_solicitado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_empresa_cliente_id_fkey"
            columns: ["empresa_cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_linha_edital_id_fkey"
            columns: ["linha_edital_id"]
            isOneToOne: false
            referencedRelation: "linhas_editais_finep"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_projeto: {
        Row: {
          concluida_em: string | null
          created_at: string
          data_prazo: string | null
          descricao: string | null
          id: string
          origem_discussao_id: string | null
          prioridade: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          data_prazo?: string | null
          descricao?: string | null
          id?: string
          origem_discussao_id?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          data_prazo?: string | null
          descricao?: string | null
          id?: string
          origem_discussao_id?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_projeto_origem_discussao_id_fkey"
            columns: ["origem_discussao_id"]
            isOneToOne: false
            referencedRelation: "discussao_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios_internos: {
        Row: {
          ativo: boolean
          convidado_por: string | null
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          ultimo_login: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          convidado_por?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          status?: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          convidado_por?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_internos_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      marcos_com_urgencia: {
        Row: {
          consultor_responsavel_id: string | null
          created_at: string | null
          data_entrega_real: string | null
          data_prevista: string | null
          descricao: string | null
          dias_para_vencer: number | null
          empresa_cliente_id: string | null
          empresa_razao_social: string | null
          id: string | null
          nome_projeto: string | null
          projeto_id: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_marco"] | null
          tipo: Database["public"]["Enums"]["tipo_marco"] | null
          updated_at: string | null
          urgencia: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_clientes_consultor_responsavel_id_fkey"
            columns: ["consultor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_entregas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_cliente_id_fkey"
            columns: ["empresa_cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      empresa_no_escopo: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      gen_codigo_rastreio: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      pode_alterar_admin: { Args: { _user_id: string }; Returns: boolean }
      projeto_no_escopo: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      registrar_nova_versao_documento:
        | {
            Args: {
              _descricao: string
              _grupo_documento_id: string
              _mime_type: string
              _nome_arquivo: string
              _projeto_id: string
              _storage_path: string
              _tamanho_arquivo: number
              _tipo: Database["public"]["Enums"]["tipo_documento"]
            }
            Returns: {
              criado_em: string
              descricao_da_versao: string
              e_versao_atual: boolean
              empresa_cliente_id: string | null
              enviado_por: string | null
              grupo_documento_id: string
              id: string
              mime_type: string | null
              nome_arquivo: string
              numero_versao: number
              projeto_id: string | null
              storage_path: string
              tamanho_arquivo: number
              tipo: Database["public"]["Enums"]["tipo_documento"]
            }
            SetofOptions: {
              from: "*"
              to: "documentos"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _descricao: string
              _empresa_cliente_id?: string
              _grupo_documento_id: string
              _mime_type: string
              _nome_arquivo: string
              _projeto_id: string
              _storage_path: string
              _tamanho_arquivo: number
              _tipo: Database["public"]["Enums"]["tipo_documento"]
            }
            Returns: {
              criado_em: string
              descricao_da_versao: string
              e_versao_atual: boolean
              empresa_cliente_id: string | null
              enviado_por: string | null
              grupo_documento_id: string
              id: string
              mime_type: string | null
              nome_arquivo: string
              numero_versao: number
              projeto_id: string | null
              storage_path: string
              tamanho_arquivo: number
              tipo: Database["public"]["Enums"]["tipo_documento"]
            }
            SetofOptions: {
              from: "*"
              to: "documentos"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      vincular_email_manual: {
        Args: { _pendente_id: string; _projeto_id: string }
        Returns: {
          anexos_referenciados: Json
          assunto: string | null
          corpo_texto: string | null
          criado_em: string
          data_email_original: string | null
          dedup_hash: string
          id: string
          message_id: string | null
          projeto_id: string
          remetente_original: string
        }
        SetofOptions: {
          from: "*"
          to: "emails_vinculados"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "consultor"
      categoria_edital:
        | "subvencao_economica"
        | "reembolsavel"
        | "RHAE"
        | "outro"
      porte_empresa: "ME" | "EPP" | "Grande"
      status_empresa: "lead" | "ativo" | "inativo"
      status_marco: "pendente" | "entregue" | "atrasado"
      status_projeto:
        | "em_elaboracao"
        | "submetido"
        | "em_analise"
        | "aprovado"
        | "contratado"
        | "em_execucao"
        | "em_prestacao_contas"
        | "encerrado"
        | "reprovado"
      tarefa_prioridade: "baixa" | "media" | "alta"
      tarefa_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      tipo_documento:
        | "material"
        | "contrato"
        | "aditivo"
        | "relatorio"
        | "outro"
      tipo_insight_ia: "alerta_risco" | "sugestao" | "rascunho_relatorio"
      tipo_interacao:
        | "reuniao"
        | "email"
        | "ligacao"
        | "alteracao_cronograma"
        | "aditivo_contratual"
        | "nota"
        | "documento"
        | "email_encaminhado"
      tipo_marco:
        | "relatorio_tecnico"
        | "relatorio_financeiro"
        | "prestacao_contas_parcial"
        | "prestacao_contas_final"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "consultor"],
      categoria_edital: [
        "subvencao_economica",
        "reembolsavel",
        "RHAE",
        "outro",
      ],
      porte_empresa: ["ME", "EPP", "Grande"],
      status_empresa: ["lead", "ativo", "inativo"],
      status_marco: ["pendente", "entregue", "atrasado"],
      status_projeto: [
        "em_elaboracao",
        "submetido",
        "em_analise",
        "aprovado",
        "contratado",
        "em_execucao",
        "em_prestacao_contas",
        "encerrado",
        "reprovado",
      ],
      tarefa_prioridade: ["baixa", "media", "alta"],
      tarefa_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      tipo_documento: ["material", "contrato", "aditivo", "relatorio", "outro"],
      tipo_insight_ia: ["alerta_risco", "sugestao", "rascunho_relatorio"],
      tipo_interacao: [
        "reuniao",
        "email",
        "ligacao",
        "alteracao_cronograma",
        "aditivo_contratual",
        "nota",
        "documento",
        "email_encaminhado",
      ],
      tipo_marco: [
        "relatorio_tecnico",
        "relatorio_financeiro",
        "prestacao_contas_parcial",
        "prestacao_contas_final",
      ],
    },
  },
} as const
