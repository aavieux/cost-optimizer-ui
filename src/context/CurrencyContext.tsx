import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Currency = 'USD' | 'EUR'

const RATE_KEY = 'eur_usd_rate'

function storedRate(): number {
  try {
    const n = parseFloat(localStorage.getItem(RATE_KEY) ?? '')
    return Number.isFinite(n) && n > 0 ? n : 1
  } catch {
    return 1
  }
}

async function fetchEurRate(): Promise<number> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { rates: { EUR: number } }
  return json.rates.EUR
}

type CurrencyContextValue = {
  currency: Currency
  setCurrency: (c: Currency) => void
  rate: number
  isLoadingRate: boolean
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  rate: 1,
  isLoadingRate: false,
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const s = localStorage.getItem('currency')
    return s === 'EUR' ? 'EUR' : 'USD'
  })
  const [rate, setRate] = useState(storedRate)
  const [isLoadingRate, setIsLoadingRate] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoadingRate(true)
    fetchEurRate()
      .then((r) => {
        if (cancelled) return
        setRate(r)
        localStorage.setItem(RATE_KEY, String(r))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingRate(false) })
    return () => { cancelled = true }
  }, [])

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    localStorage.setItem('currency', c)
  }, [])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, isLoadingRate }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

export function useFormatCurrency() {
  const { currency, rate } = useCurrency()
  return useCallback(
    (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(currency === 'EUR' ? value * rate : value),
    [currency, rate],
  )
}
