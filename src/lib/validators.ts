<<<<<<< HEAD
// Validadores reutilizáveis (CNPJ, CPF, etc)

export function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false; // Rejeita "11111111111111"

  // Calcular dígitos verificadores (algoritmo padrão)
  let size = nums.length - 2;
  let numbers = nums.substring(0, size);
  const digits = nums.substring(size);

  // Primeiro dígito
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(0))) return false;

  // Segundo dígito
  size += 1;
  numbers = nums.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(1))) return false;

  return true;
}

export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return false;
  if (/^(\d)\1+$/.test(nums)) return false; // Rejeita "11111111111"

  // Primeiro dígito
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(nums.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== Number(nums.charAt(9))) return false;

  // Segundo dígito
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(nums.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== Number(nums.charAt(10))) return false;

  return true;
}

// MIME types permitidos para documentos
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-word.document.macroEnabled.12", // .docm
  "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB
=======
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
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
