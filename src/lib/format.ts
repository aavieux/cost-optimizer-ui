export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatSavingsPercent(current: number, savings: number): string {
  if (current === 0) return '0%'
  return `${((savings / current) * 100).toFixed(1)}%`
}
