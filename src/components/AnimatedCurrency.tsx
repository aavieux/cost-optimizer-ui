import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { formatCurrency } from '@/lib/format'

type Props = {
  value: number
  className?: string
}

export default function AnimatedCurrency({ value, className }: Props) {
  const raw = useMotionValue(value)
  const spring = useSpring(raw, { stiffness: 80, damping: 22, mass: 0.6 })
  const formatted = useTransform(spring, (v) => formatCurrency(v))

  useEffect(() => {
    raw.set(value)
  }, [raw, value])

  return <motion.span className={className}>{formatted}</motion.span>
}
