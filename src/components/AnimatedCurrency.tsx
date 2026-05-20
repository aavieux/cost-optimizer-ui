import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { useFormatCurrency } from '@/context/CurrencyContext'

type Props = {
  value: number
  className?: string
}

export default function AnimatedCurrency({ value, className }: Props) {
  const fmt = useFormatCurrency()
  const raw = useMotionValue(value)
  const spring = useSpring(raw, { stiffness: 80, damping: 22, mass: 0.6 })
  const [display, setDisplay] = useState(() => fmt(value))

  useEffect(() => { raw.set(value) }, [raw, value])

  useEffect(() => {
    setDisplay(fmt(spring.get()))
    return spring.on('change', (v: number) => setDisplay(fmt(v)))
  }, [spring, fmt])

  return <span className={className}>{display}</span>
}
