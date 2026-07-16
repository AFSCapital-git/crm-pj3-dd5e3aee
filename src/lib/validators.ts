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

export function formatCpfCnpj(input: string): string {
  const nums = input.replace(/\D/g, "");
  if (nums.length <= 11) {
    return nums
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  return nums
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
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
