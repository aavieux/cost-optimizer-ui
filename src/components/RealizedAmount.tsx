import { useFormatCurrency } from '@/context/CurrencyContext'
import AnimatedCurrency from './AnimatedCurrency'

type Props = {
  value: number
  animated?: boolean
}

export default function RealizedAmount({ value, animated = false }: Props) {
  const fmt = useFormatCurrency()
  return animated
    ? <AnimatedCurrency value={value} className="text-fluid-green" />
    : <span className="text-fluid-green">{fmt(value)}</span>
}
