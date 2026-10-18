import { useFormatCurrency } from '@/context/CurrencyContext'
import AnimatedCurrency from './AnimatedCurrency'

type Props = {
  value: number
  animated?: boolean
}

export default function PotentialAmount({ value, animated = false }: Props) {
  const fmt = useFormatCurrency()
  return animated
    ? <AnimatedCurrency value={value} className="text-fluid-blue" />
    : <span className="text-fluid-blue">{fmt(value)}</span>
}
