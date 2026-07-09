import { Info, ChevronRight } from "lucide-react"
import AnimatedCurrency from "./AnimatedCurrency"
import RealizedAmount from "./RealizedAmount"
import PotentialAmount from "./PotentialAmount"
import { useFormatCurrency } from "@/context/CurrencyContext"
import { formatSavingsPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TimeWindow } from "@/types/dashboard"

export type TimeWindowOption = { label: string; value: TimeWindow; diagnostic?: boolean }

const DEFAULT_TIME_WINDOWS: TimeWindowOption[] = [
  { label: "1d", value: "1d", diagnostic: true },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
]

export type CostOverview = {
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
}

export type UnboundedInfo = {
  count: number
  monthly_cost_recommended: number
}

// ─── shared primitives ───────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span className={cn("w-1.5 h-1.5 rounded-full inline-block shrink-0", color)} />
}

function Tooltip({ children, alignRight, wide }: { children: React.ReactNode; alignRight?: boolean; wide?: boolean }) {
  return (
    <div className="relative group/tip">
      <Info size={11} className="text-neutral-300 cursor-default" />
      <div className={cn(
        "absolute bottom-full mb-2 px-3 py-2 bg-neutral-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed",
        alignRight ? "right-0" : "left-0",
        wide ? "w-64" : "w-60",
      )}>
        {children}
      </div>
    </div>
  )
}

function BigAmount({ value }: { value: number }) {
  return (
    <p className="text-2xl font-semibold text-neutral-900">
      <AnimatedCurrency value={value} />
      <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
    </p>
  )
}

// ─── cells ───────────────────────────────────────────────────────────────────

function CurrentCostCell({
  value,
  label,
  tooltip,
  unboundedInfo,
}: {
  value: number
  label: string
  tooltip?: string
  unboundedInfo?: UnboundedInfo | null
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-1 mb-2">
        <p className="text-xs text-neutral-400 uppercase tracking-wide">{label}</p>
        {tooltip && <Tooltip>{tooltip}</Tooltip>}
      </div>
      <BigAmount value={value} />
      {unboundedInfo && unboundedInfo.count > 0 && (
        <div className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
          <Dot color="bg-violet-300" />
          excludes {unboundedInfo.count} unbounded
        </div>
      )}
    </div>
  )
}

function RecommendedCell({ value, unboundedInfo }: { value: number; unboundedInfo?: UnboundedInfo | null }) {
  const fmt = useFormatCurrency()
  return (
    <div className="p-6">
      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Recommended</p>
      <BigAmount value={value} />
      {unboundedInfo && unboundedInfo.count > 0 && (
        <div className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
          <Dot color="bg-violet-300" />
          {fmt(unboundedInfo.monthly_cost_recommended)} unbounded
          <Tooltip wide>
            Unbounded workloads have no CPU or memory limit set, so their true cost cannot be
            determined. This figure reflects the recommended cost if limits were applied — it is
            not included in the main recommended total.
          </Tooltip>
        </div>
      )}
    </div>
  )
}

function SavingsCell({
  costOverview,
  label,
  timeWindow,
  insufficientDataCount,
}: {
  costOverview: CostOverview
  label: string
  timeWindow: TimeWindow
  insufficientDataCount: number
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-1 mb-2">
        <p className="text-xs text-neutral-400 uppercase tracking-wide">{label}</p>
        <Tooltip alignRight>
          Projected monthly savings based on{" "}
          <span className="font-medium">{timeWindow}</span> of usage data. Recent changes to
          workload behavior may take a full {timeWindow} window to be reflected.
        </Tooltip>
      </div>
      <p className="text-2xl font-semibold">
        <PotentialAmount value={costOverview.monthly_savings} animated />
        <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
      </p>
      <p className="text-xs text-neutral-400 mt-1">
        {formatSavingsPercent(costOverview.monthly_cost_current, costOverview.monthly_savings)} reduction
      </p>
      {insufficientDataCount > 0 && (
        <div className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
          <Dot color="bg-neutral-300" />
          {insufficientDataCount} insufficient data
        </div>
      )}
    </div>
  )
}

function RealizedSavingsCell({ value, onShowHistory }: { value: number; onShowHistory?: () => void }) {
  return (
    <div
      className={cn(
        "p-6 rounded-br-xl",
        onShowHistory && "group cursor-pointer hover:bg-neutral-50 transition-colors",
      )}
      onClick={onShowHistory}
    >
      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Realized Savings</p>
      <p className="text-2xl font-semibold">
        <RealizedAmount value={value} animated />
      </p>
      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
        all time
        {onShowHistory && (
          <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </p>
    </div>
  )
}

// ─── ribbon ──────────────────────────────────────────────────────────────────

type Props = {
  costOverview: CostOverview | null
  realizedSavings: number
  timeWindow: TimeWindow
  onTimeWindowChange: (w: TimeWindow) => void
  // optional overrides
  timeWindows?: TimeWindowOption[]
  currentCostLabel?: string
  currentCostTooltip?: string
  savingsLabel?: string
  unboundedInfo?: UnboundedInfo | null
  insufficientDataCount?: number
  onShowHistory?: () => void
}

export default function CostOverviewRibbon({
  costOverview,
  realizedSavings,
  timeWindow,
  onTimeWindowChange,
  timeWindows = DEFAULT_TIME_WINDOWS,
  currentCostLabel = "Current Monthly Price",
  currentCostTooltip = "Estimated monthly cost based on the current resource requests of all active workloads and their pod counts.",
  savingsLabel = "Potential Monthly Savings",
  unboundedInfo = null,
  insufficientDataCount = 0,
  onShowHistory,
}: Props) {
  const empty: CostOverview = { monthly_cost_current: 0, monthly_cost_recommended: 0, monthly_savings: 0 }
  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Cost Overview</p>
        <div className="flex items-center gap-1 bg-white/50 border border-white/60 rounded-lg p-1">
          {timeWindows.map(({ label, value, diagnostic }) => (
            <button
              key={value}
              onClick={() => onTimeWindowChange(value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                timeWindow === value && diagnostic
                  ? "bg-amber-50 text-amber-700 shadow-sm"
                  : timeWindow === value
                  ? "bg-[#2563AF]/10 text-[#2563AF]"
                  : "text-neutral-400 hover:text-neutral-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {timeWindow === "1d" && (
        <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
          <span className="font-medium">Diagnostic view</span>
          <span className="text-amber-400">·</span>
          <span>Low data thresholds — not recommended for production rightsizing decisions</span>
        </div>
      )}
      <div className="grid grid-cols-4 divide-x divide-neutral-100">
        <CurrentCostCell
          value={costOverview?.monthly_cost_current ?? 0}
          label={currentCostLabel}
          tooltip={currentCostTooltip}
          unboundedInfo={unboundedInfo}
        />
        <RecommendedCell
          value={costOverview?.monthly_cost_recommended ?? 0}
          unboundedInfo={unboundedInfo}
        />
        <SavingsCell
          costOverview={costOverview ?? empty}
          label={savingsLabel}
          timeWindow={timeWindow}
          insufficientDataCount={insufficientDataCount}
        />
        <RealizedSavingsCell value={realizedSavings} onShowHistory={onShowHistory} />
      </div>
    </>
  )
}
