import { createContext, useContext, useState, useCallback } from 'react'

export type Currency = 'USD' | 'EUR'

// TODO: fetch live rate from an exchange rate API (e.g. frankfurter.app/latest?from=USD&to=EUR)
const HARDCODED_EUR_RATE = 0.92

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

  const rate = HARDCODED_EUR_RATE
  const isLoadingRate = false

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
