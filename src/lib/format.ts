export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) throw new Error("Bytes cannot be negative");
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GiB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MiB`;
  return `${bytes} B`;
}
export function fmtCpu(raw: string): string {
  if (raw.endsWith('m')) {
    const cores = parseInt(raw, 10) / 1000
    return `${parseFloat(cores.toFixed(3))}`
  }
  return raw
}

export function fmtRam(raw: string): string {
  if (raw.endsWith('Mi')) {
    const mi = parseInt(raw, 10)
    if (mi >= 1024) return `${parseFloat((mi / 1024).toFixed(1))}Gi`
    return raw
  }
  return raw
}

export function formatSavingsPercent(current: number, savings: number): string {
  if (current === 0) return "0%";
  return `${((savings / current) * 100).toFixed(1)}%`;
}
