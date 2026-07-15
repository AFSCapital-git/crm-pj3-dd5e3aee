import { useMemo, useRef, useState, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  History,
  Search,
  Star,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocumentosByProjeto,
  listDocumentosByEmpresa,
  registerDocumentoVersion,
  getDocumentoDownloadUrl,
} from "@/lib/documentos.functions";
import {
  formatFileSize,
  formatDate,
  tipoDocumentoLabel,
  tiposDocumento,
} from "@/lib/labels";

type TipoDoc = (typeof tiposDocumento)[number];
type DocumentoRow = {
  id: string;
  projeto_id: string | null;
  empresa_cliente_id: string | null;
  grupo_documento_id: string;
  tipo: TipoDoc;
  nome_arquivo: string;
  numero_versao: number;
  storage_path: string;
  tamanho_arquivo: number;
  mime_type: string | null;
  descricao_da_versao: string;
  e_versao_atual: boolean;
  criado_em: string;
  autor: { id: string; nome: string } | null;
};

type Owner =
  | { kind: "projeto"; projetoId: string }
  | { kind: "empresa"; empresaId: string };

const BUCKET = "documentos-projetos";
const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp";
const EXT_REGEX = /\.(pdf|docx?|xlsx?|png|jpe?g|webp)$/i;
const ALLOWED_EXTS = "PDF, DOCX, XLSX, PNG, JPG, WEBP";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}
function validateFile(file: File): string | null {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_BYTES)
    return `Arquivo muito grande (${formatFileSize(file.size)}). Limite: 25 MB.`;
  if (!EXT_REGEX.test(file.name))
    return `Tipo não suportado. Use ${ALLOWED_EXTS}.`;
  return null;
}

async function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
    xhr.setRequestHeader("x-upsert", "false");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Falha no upload (HTTP ${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message) msg = parsed.message;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
    xhr.onabort = () => reject(new Error("Upload cancelado."));
    xhr.send(file);
  });
}

function ownerKey(o: Owner) {
  return o.kind === "projeto" ? o.projetoId : o.empresaId;
}
function storagePrefix(o: Owner) {
  return o.kind === "projeto" ? o.projetoId : `empresa/${o.empresaId}`;
}


export function DocumentosTab(props:
  | { projetoId: string; empresaId?: never }
  | { empresaId: string; projetoId?: never }) {
  const owner: Owner = props.projetoId
    ? { kind: "projeto", projetoId: props.projetoId }
    : { kind: "empresa", empresaId: props.empresaId! };

  const listByProjeto = useServerFn(listDocumentosByProjeto);
  const listByEmpresa = useServerFn(listDocumentosByEmpresa);

  const q = useQuery({
    queryKey: ["documentos", owner.kind, ownerKey(owner)],
    queryFn: () =>
      (owner.kind === "projeto"
        ? listByProjeto({ data: { projeto_id: owner.projetoId } })
        : listByEmpresa({ data: { empresa_cliente_id: owner.empresaId } })
      ) as Promise<DocumentoRow[]>,
  });

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoDoc | "todos">("todos");
  const [grupoFilter, setGrupoFilter] = useState("");

  const grupos = useMemo(() => {
    const rows = (q.data ?? []) as DocumentoRow[];
    const byGrupo = new Map<string, DocumentoRow[]>();
    for (const r of rows) {
      const arr = byGrupo.get(r.grupo_documento_id) ?? [];
      arr.push(r);
      byGrupo.set(r.grupo_documento_id, arr);
    }
    const grupos = [...byGrupo.values()].map((versoes) => {
      versoes.sort((a, b) => b.numero_versao - a.numero_versao);
      const atual = versoes.find((v) => v.e_versao_atual) ?? versoes[0];
      return { grupoId: atual.grupo_documento_id, tipo: atual.tipo, atual, versoes };
    });
    grupos.sort(
      (a, b) => new Date(b.atual.criado_em).getTime() - new Date(a.atual.criado_em).getTime(),
    );
    return grupos;
  }, [q.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const g = grupoFilter.trim().toLowerCase();
    return grupos.filter((grp) => {
      if (tipoFilter !== "todos" && grp.tipo !== tipoFilter) return false;
      if (g && !grp.grupoId.toLowerCase().includes(g)) return false;
      if (s) {
        const inAny = grp.versoes.some((v) =>
          v.nome_arquivo.toLowerCase().includes(s),
        );
        if (!inAny) return false;
      }
      return true;
    });
  }, [grupos, search, tipoFilter, grupoFilter]);

  const gruposPorTipo = useMemo(() => {
    const out: Record<TipoDoc, typeof grupos> = {
      material: [],
      contrato: [],
      aditivo: [],
      relatorio: [],
      outro: [],
    };
    for (const g of filtered) out[g.tipo].push(g);
    return out;
  }, [filtered]);

  const hasFilters =
    search.trim() !== "" || tipoFilter !== "todos" || grupoFilter.trim() !== "";
  const tiposParaExibir =
    tipoFilter === "todos" ? tiposDocumento : ([tipoFilter] as TipoDoc[]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando documentos…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_1fr_auto]">
            <div>
              <Label className="text-xs">Buscar por nome do arquivo</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ex.: contrato_finep.pdf"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={tipoFilter}
                onValueChange={(v) => setTipoFilter(v as TipoDoc | "todos")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tiposDocumento.map((t) => (
                    <SelectItem key={t} value={t}>{tipoDocumentoLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ID do grupo (grupo_documento_id)</Label>
              <Input
                value={grupoFilter}
                onChange={(e) => setGrupoFilter(e.target.value)}
                placeholder="UUID completo ou parcial"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                disabled={!hasFilters}
                onClick={() => {
                  setSearch("");
                  setTipoFilter("todos");
                  setGrupoFilter("");
                }}
              >
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
          </div>
          {hasFilters && (
            <p className="text-xs text-muted-foreground mt-3">
              {filtered.length} {filtered.length === 1 ? "documento encontrado" : "documentos encontrados"}
            </p>
          )}
        </CardContent>
      </Card>

      {tiposParaExibir.map((tipo) => (
        <TipoSection
          key={tipo}
          owner={owner}
          tipo={tipo}
          grupos={gruposPorTipo[tipo]}
          filteringActive={hasFilters}
        />
      ))}
    </div>
  );
}

function TipoSection({
  owner,
  tipo,
  grupos,
  filteringActive,
}: {
  owner: Owner;
  tipo: TipoDoc;
  grupos: { grupoId: string; tipo: TipoDoc; atual: DocumentoRow; versoes: DocumentoRow[] }[];
  filteringActive: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h3 className="text-base font-semibold">{tipoDocumentoLabel(tipo)}</h3>
            <Badge variant="outline">{grupos.length}</Badge>
          </div>
        </button>

        {open && (
          <div className="space-y-4">
            {!filteringActive && <NewDocumentDropzone owner={owner} tipo={tipo} />}
            {grupos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filteringActive
                  ? "Nenhum documento corresponde aos filtros."
                  : "Nenhum documento neste grupo ainda."}
              </p>
            ) : (
              <div className="space-y-3">
                {grupos.map((g) => (
                  <DocumentGroupCard
                    key={g.grupoId}
                    owner={owner}
                    tipo={tipo}
                    atual={g.atual}
                    versoes={g.versoes}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentGroupCard({
  owner,
  tipo,
  atual,
  versoes,
}: {
  owner: Owner;
  tipo: TipoDoc;
  atual: DocumentoRow;
  versoes: DocumentoRow[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [openNewVersion, setOpenNewVersion] = useState(false);
  return (
    <div className="rounded-md border bg-card">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="font-medium truncate">{atual.nome_arquivo}</p>
            <Badge className="bg-urgency-ok text-urgency-ok-fg border-transparent gap-1">
              <Star className="h-3 w-3 fill-current" /> Versão atual v{atual.numero_versao}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatFileSize(atual.tamanho_arquivo)} · enviado por{" "}
            {atual.autor?.nome ?? "—"} em {formatDate(atual.criado_em)}
            {" · "}
            {versoes.length} {versoes.length === 1 ? "versão" : "versões"}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono mt-1 break-all">
            grupo: {atual.grupo_documento_id}
          </p>
          {atual.descricao_da_versao && (
            <p className="text-sm mt-2">{atual.descricao_da_versao}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <DownloadButton documentoId={atual.id} />
          <Button size="sm" variant="outline" onClick={() => setOpenNewVersion(true)}>
            <Upload className="h-4 w-4 mr-1" /> Nova versão
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            <History className="h-4 w-4 mr-1" />
            {showHistory ? "Ocultar" : "Histórico"}
          </Button>
        </div>
      </div>

      {showHistory && (
        <div className="border-t divide-y">
          {versoes.map((v) => (
            <div
              key={v.id}
              className={cn(
                "px-4 py-3 flex items-center justify-between gap-4",
                v.e_versao_atual
                  ? "bg-urgency-ok/10 border-l-4 border-l-urgency-ok"
                  : "opacity-70",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {v.e_versao_atual ? (
                    <Badge className="bg-urgency-ok text-urgency-ok-fg border-transparent gap-1">
                      <Star className="h-3 w-3 fill-current" /> Versão atual · v{v.numero_versao}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      v{v.numero_versao} · arquivada
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.criado_em).toLocaleString("pt-BR")} ·{" "}
                    {v.autor?.nome ?? "—"} · {formatFileSize(v.tamanho_arquivo)}
                  </span>
                </div>
                {v.descricao_da_versao && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    {v.descricao_da_versao}
                  </p>
                )}
              </div>
              <DownloadButton documentoId={v.id} />
            </div>
          ))}
        </div>
      )}

      <NewVersionDialog
        open={openNewVersion}
        onOpenChange={setOpenNewVersion}
        owner={owner}
        tipo={tipo}
        grupoDocumentoId={atual.grupo_documento_id}
      />
    </div>
  );
}

function DownloadButton({ documentoId }: { documentoId: string }) {
  const fn = useServerFn(getDocumentoDownloadUrl);
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try {
      const { url } = await fn({ data: { documento_id: documentoId } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={handle} disabled={loading}>
      <Download className="h-4 w-4 mr-1" /> Baixar
    </Button>
  );
}

/* ---------- Upload dropzones ---------- */

function NewDocumentDropzone({ owner, tipo }: { owner: Owner; tipo: TipoDoc }) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  return (
    <>
      <Dropzone
        label="Arraste um arquivo aqui ou clique para adicionar um novo documento"
        onFile={setPendingFile}
      />
      <UploadDialog
        open={!!pendingFile}
        onOpenChange={(v) => !v && setPendingFile(null)}
        file={pendingFile}
        owner={owner}
        tipo={tipo}
        grupoDocumentoId={null}
      />
    </>
  );
}

function NewVersionDialog({
  open,
  onOpenChange,
  owner,
  tipo,
  grupoDocumentoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  owner: Owner;
  tipo: TipoDoc;
  grupoDocumentoId: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setFile(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova versão</DialogTitle>
        </DialogHeader>
        {!file ? (
          <Dropzone
            label="Arraste o arquivo da nova versão aqui ou clique para selecionar"
            onFile={setFile}
          />
        ) : (
          <UploadForm
            file={file}
            owner={owner}
            tipo={tipo}
            grupoDocumentoId={grupoDocumentoId}
            onDone={() => {
              setFile(null);
              onOpenChange(false);
            }}
            requireDescription
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  file,
  owner,
  tipo,
  grupoDocumentoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  owner: Owner;
  tipo: TipoDoc;
  grupoDocumentoId: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
        </DialogHeader>
        {file && (
          <UploadForm
            file={file}
            owner={owner}
            tipo={tipo}
            grupoDocumentoId={grupoDocumentoId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({
  file,
  owner,
  tipo,
  grupoDocumentoId,
  onDone,
  requireDescription = false,
}: {
  file: File;
  owner: Owner;
  tipo: TipoDoc;
  grupoDocumentoId: string | null;
  onDone: () => void;
  requireDescription?: boolean;
}) {
  const [descricao, setDescricao] = useState("");
  const qc = useQueryClient();
  const registerFn = useServerFn(registerDocumentoVersion);

  const m = useMutation({
    mutationFn: async () => {
      const grupoId = grupoDocumentoId ?? crypto.randomUUID();
      const safeName = sanitize(file.name);
      const stamp = Date.now();
      const path = `${storagePrefix(owner)}/${grupoId}/${stamp}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;

      try {
        return await registerFn({
          data: {
            projeto_id: owner.kind === "projeto" ? owner.projetoId : null,
            empresa_cliente_id: owner.kind === "empresa" ? owner.empresaId : null,
            grupo_documento_id: grupoDocumentoId ?? grupoId,
            tipo,
            nome_arquivo: file.name,
            storage_path: path,
            tamanho_arquivo: file.size,
            mime_type: file.type || null,
            descricao_da_versao: descricao,
          },
        });
      } catch (e) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw e;
      }
    },
    onSuccess: () => {
      toast.success("Documento enviado");
      qc.invalidateQueries({ queryKey: ["documentos", owner.kind, ownerKey(owner)] });
      if (owner.kind === "projeto") {
        qc.invalidateQueries({ queryKey: ["projeto", owner.projetoId] });
      } else {
        qc.invalidateQueries({ queryKey: ["empresa", owner.empresaId] });
      }
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha no upload"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (requireDescription && !descricao.trim()) {
          toast.error("Descreva o que mudou nesta versão.");
          return;
        }
        m.mutate();
      }}
      className="space-y-3"
    >
      <div className="rounded-md border p-3 bg-muted/40 text-sm">
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <div>
        <Label>
          {requireDescription
            ? "O que mudou nesta versão? (obrigatório)"
            : "Descrição (opcional)"}
        </Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: revisão após feedback do FINEP"
          required={requireDescription}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? "Enviando…" : "Enviar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Dropzone({
  label,
  onFile,
}: {
  label: string;
  onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const err = validateFile(f);
    if (err) {
      toast.error(err);
      return;
    }
    onFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
        drag ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/40",
      )}
    >
      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">
        PDF, DOCX, XLSX, PNG, JPG, WEBP · até 25 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
