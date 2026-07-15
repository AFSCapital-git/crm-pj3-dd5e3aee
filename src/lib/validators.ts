// Validadores para CPF, CNPJ, e-mail e telefone (BR).

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

export function isValidCPF(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

export function isValidCNPJ(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

export function validateCpfCnpj(input: string): string | null {
  const digits = onlyDigits(input);
  if (!digits) return "Informe o CPF ou CNPJ.";
  if (digits.length === 11) return isValidCPF(digits) ? null : "CPF inválido.";
  if (digits.length === 14) return isValidCNPJ(digits) ? null : "CNPJ inválido.";
  return "Deve conter 11 (CPF) ou 14 (CNPJ) dígitos.";
}

export function formatCpfCnpj(input: string): string {
  const d = onlyDigits(input);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

export function validateEmail(input: string, required = false): string | null {
  const v = (input ?? "").trim();
  if (!v) return required ? "Informe o e-mail." : null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  return ok ? null : "E-mail inválido.";
}

export function validateTelefone(input: string, required = false): string | null {
  const d = onlyDigits(input);
  if (!d) return required ? "Informe o telefone." : null;
  if (d.length < 10 || d.length > 11) return "Telefone deve ter 10 ou 11 dígitos (com DDD).";
  return null;
}

export function formatTelefone(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}
