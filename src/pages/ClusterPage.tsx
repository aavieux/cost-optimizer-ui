import { useState, useMemo, useRef, useEffect, startTransition } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Info,
  Cog,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { useClusterSummary } from "@/hooks/useClusterSummary";
import { useClusterMetrics } from "@/hooks/useClusterMetrics";
import { useClusterRecommendations } from "@/hooks/useClusterRecommendations";
import { useApplyRecommendation } from "@/hooks/useApplyRecommendation";
import {
  formatBytes,
  formatSavingsPercent,
  fmtCpu,
  fmtRam,
} from "@/lib/format";
import { useFormatCurrency } from "@/context/CurrencyContext";
import { getErrorCode } from "@/lib/api";
import { cn } from "@/lib/utils";
import AnimatedCurrency from "@/components/AnimatedCurrency";
import Dialog from "@/components/Dialog";
import type { TimeWindow } from "@/types/dashboard";
import type {
  MetricPoint,
  WorkloadRecommendation,
  PendingWorkload,
} from "@/types/cluster";

// ─── constants ────────────────────────────────────────────────────────────────

const TIME_WINDOWS: { label: string; value: TimeWindow; diagnostic?: boolean }[] = [
  { label: "1d", value: "1d", diagnostic: true },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function savingsLabel(): string {
  return "Potential Monthly Savings"
}

const PROVIDER_STYLE: Record<string, string> = {
  azure: "text-blue-600 bg-blue-50",
  aws:   "text-orange-600 bg-orange-50",
  gcp:   "text-green-600 bg-green-50",
  local: "text-neutral-400 bg-neutral-100",
}

function fmtRelativeTime(iso: string, now: number): string {
  const secs = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (secs < 60) return "just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

type GranularityView = "hour" | "day";

const GRANULARITY_OPTIONS: { label: string; value: GranularityView }[] = [
  { label: "Hour", value: "hour" },
  { label: "Day", value: "day" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}


function todayStr(): string {
  return localDateStr(new Date());
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function fmtDateInput(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = d.toLocaleDateString("en-US", { month: "short" });
  return `${dd}/${mmm}/${d.getFullYear()}`;
}

function DatePicker({
  value,
  min,
  max,
  onChange,
  className,
  label,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    const [y, m] = value
      ? value.split("-").map(Number)
      : [new Date().getFullYear(), new Date().getMonth() + 1];
    setViewYear(y);
    setViewMonth(m - 1);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function toStr(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const startDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthName = viewYear
    ? new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long" })
    : "";

  return (
    <div ref={wrapRef} className="relative inline-block">
      <span
        onClick={openPicker}
        className={cn(
          "text-xs text-neutral-700 border-b border-neutral-200 pb-px cursor-pointer select-none hover:border-neutral-400 transition-colors",
          className,
        )}
      >
        {label ?? fmtDateInput(value)}
      </span>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white/70 backdrop-blur-sm border border-white/70 shadow-md rounded-xl shadow-lg p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={prevMonth}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded transition-colors text-base leading-none"
            >
              ‹
            </button>
            <span className="text-xs font-medium text-neutral-700">
              {monthName} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded transition-colors text-base leading-none"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-neutral-400 py-0.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const dateStr = toStr(viewYear, viewMonth, day);
              const selected = dateStr === value;
              const disabled = Boolean((min && dateStr < min) || (max && dateStr > max));
              return (
                <button
                  key={dateStr}
                  onClick={() => { if (!disabled) { onChange(dateStr); setOpen(false); } }}
                  className={cn(
                    "text-xs rounded py-1 transition-colors leading-none",
                    selected ? "bg-neutral-900 text-white"
                      : disabled ? "text-neutral-200 cursor-not-allowed"
                      : "text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type ChartPoint = MetricPoint & { ts_ms: number };
type MergedChartPoint = ChartPoint & {
  app_val?: number | null;
  sys_val?: number | null;
};

function sumOrNull(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function fmtTime(v: number): string {
  return new Date(v).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDate(v: number): string {
  return new Date(v).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── MetricChart ──────────────────────────────────────────────────────────────

type MetricChartProps = {
  appData: ChartPoint[];
  systemData?: ChartPoint[];
  dataKey: "cpu_cores" | "ram_bytes";
  label: string;
  valueFormatter: (v: number) => string;
  domain: [number | string, number | string];
  tickFormatter: (v: number) => string;
  tickCount: number;
  ticks?: number[];
  accent?: boolean;
  futureFrom?: number;
};

function MetricChart({
  appData,
  systemData,
  dataKey,
  label,
  valueFormatter,
  domain,
  tickFormatter,
  tickCount,
  ticks,
  accent,
  futureFrom,
}: MetricChartProps) {
  const lineColor = accent ? "#10b981" : "#a3a3a3";
  const dotColor = accent ? "#059669" : "#737373";
  const maxKey = (dataKey === "cpu_cores" ? "max_cpu_cores" : "max_ram_bytes") as
    "max_cpu_cores" | "max_ram_bytes";

  const hasSystem = (systemData?.length ?? 0) > 0;

  const mergedData = useMemo((): MergedChartPoint[] => {
    if (!hasSystem) return appData;
    return appData.map((pt, i) => {
      const sys = systemData![i];
      return {
        ...pt,
        cpu_cores:     sumOrNull(pt.cpu_cores,     sys?.cpu_cores),
        ram_bytes:     sumOrNull(pt.ram_bytes,      sys?.ram_bytes),
        max_cpu_cores: sumOrNull(pt.max_cpu_cores,  sys?.max_cpu_cores),
        max_ram_bytes: sumOrNull(pt.max_ram_bytes,  sys?.max_ram_bytes),
        app_val: pt[dataKey],
        sys_val: sys?.[dataKey] ?? null,
      };
    });
  }, [appData, systemData, hasSystem, dataKey]);

  function isSpike(pt: MergedChartPoint): boolean {
    const avg = pt[dataKey];
    const max = pt[maxKey];
    return avg != null && max != null && max > avg * 2;
  }

  return (
    <div>
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
        {label}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={mergedData}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.12} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f5f5f5" />
          <XAxis
            dataKey="ts_ms"
            type="number"
            scale="time"
            domain={domain}
            ticks={ticks}
            tickCount={ticks ? undefined : tickCount}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={valueFormatter}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "#e5e5e5", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload.find((p) => p.value != null);
              if (!entry) return null;
              const pt = entry.payload as MergedChartPoint;
              const val = pt[dataKey];
              const maxVal = pt[maxKey];
              const spike = isSpike(pt);
              return (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f5f5f5",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "8px 10px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <p style={{ color: "#a3a3a3", marginBottom: 4 }}>
                    {new Date(pt.ts_ms).toLocaleString()}
                  </p>
                  {val != null && (
                    <p style={{ color: "#171717" }}>
                      {hasSystem ? "total: " : ""}{valueFormatter(val)}
                    </p>
                  )}
                  {hasSystem && pt.app_val != null && (
                    <p style={{ color: "#a3a3a3", marginTop: 2, fontSize: 11 }}>
                      app: {valueFormatter(pt.app_val)}
                    </p>
                  )}
                  {hasSystem && pt.sys_val != null && (
                    <p style={{ color: "#a3a3a3", fontSize: 11 }}>
                      sys: {valueFormatter(pt.sys_val)}
                    </p>
                  )}
                  {maxVal != null && (
                    <p style={{ color: spike ? "#ef4444" : "#a3a3a3", marginTop: 2, fontSize: 11 }}>
                      peak: {valueFormatter(maxVal)}
                    </p>
                  )}
                </div>
              );
            }}
          />
          {futureFrom != null && typeof domain[1] === "number" && (
            <ReferenceArea
              x1={futureFrom}
              x2={domain[1] as number}
              fill="#ffffff"
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="transparent"
            fill={`url(#grad-${dataKey})`}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={1.5}
            dot={(props: { cx?: number; cy?: number; index: number; payload: MergedChartPoint }) => {
              if (!isSpike(props.payload) || props.cx == null || props.cy == null)
                return <g key={`dot-${props.index}`} />;
              return (
                <circle
                  key={`dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={3}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 3, fill: dotColor, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Workload sort / group helpers ────────────────────────────────────────────

type WorkloadSort = "name" | "savings" | "status" | "samples" | "kind" | "namespace" | "system";
type SortDir = "asc" | "desc";

const WORKLOAD_SORT_OPTIONS: { label: string; value: WorkloadSort }[] = [
  { label: "Name", value: "name" },
  { label: "Savings", value: "savings" },
  { label: "Status", value: "status" },
  { label: "Samples", value: "samples" },
  { label: "Workload type", value: "kind" },
  { label: "Group", value: "namespace" },
  { label: "System / App", value: "system" },
];

const GROUPED_SORTS: WorkloadSort[] = ["kind", "namespace", "system"];

const STATUS_ORDER: Record<string, number> = {
  WASTEFUL: 0,
  UNDER_PROVISIONED: 1,
  MIXED: 2,
  OPTIMAL: 3,
  UNBOUNDED: 4,
  INSUFFICIENT_DATA: 5,
};

type Sortable = {
  name: string;
  namespace: string;
  kind: string;
  is_system: boolean;
  sample_count: number;
  status?: string;
  monthly_savings?: number;
};

function sortItems<T extends Sortable>(
  items: T[],
  sort: WorkloadSort,
  dir: SortDir,
): T[] {
  const m = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (sort) {
      case "name":
        return m * a.name.localeCompare(b.name);
      case "samples":
        return m * (a.sample_count - b.sample_count);
      case "kind":
        return (
          m * (a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
        );
      case "namespace":
        return (
          m *
          (a.namespace.localeCompare(b.namespace) ||
            a.name.localeCompare(b.name))
        );
      case "status": {
        const oa = STATUS_ORDER[a.status ?? ""] ?? 99;
        const ob = STATUS_ORDER[b.status ?? ""] ?? 99;
        return m * (oa - ob || a.name.localeCompare(b.name));
      }
      case "savings":
        return m * ((a.monthly_savings ?? 0) - (b.monthly_savings ?? 0));
      case "system": {
        const sa = a.is_system ? 1 : 0;
        const sb = b.is_system ? 1 : 0;
        return m * ((sa - sb) || a.name.localeCompare(b.name));
      }
    }
  });
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string,
  dir: SortDir,
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return [...map.entries()].sort(([a], [b]) =>
    dir === "asc" ? a.localeCompare(b) : b.localeCompare(a),
  );
}

function sectionKey(sort: WorkloadSort): (item: Sortable) => string {
  if (sort === "kind") return (i) => i.kind;
  if (sort === "system") return (i) => (i.is_system ? "System" : "App");
  return (i) => i.namespace;
}

function isWorkloadStale(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() > 60_000;
}

// ─── WorkloadRow / PendingRow ─────────────────────────────────────────────────

const STATUS_STYLE: Record<WorkloadRecommendation["status"], string> = {
  WASTEFUL:          "text-rose-500 bg-rose-50",
  UNDER_PROVISIONED: "text-amber-600 bg-amber-50",
  OPTIMAL:           "text-emerald-600 bg-emerald-50",
  MIXED:             "text-orange-500 bg-orange-50",
  UNBOUNDED:         "text-violet-600 bg-violet-50",
  INSUFFICIENT_DATA: "text-neutral-400 bg-neutral-100",
  SPEC_CHANGED:      "text-neutral-400 bg-neutral-100",
};

const STATUS_LABEL: Record<WorkloadRecommendation["status"], string> = {
  WASTEFUL:          "Wasteful",
  UNDER_PROVISIONED: "Under-prov.",
  OPTIMAL:           "Optimal",
  MIXED:             "Mixed",
  UNBOUNDED:         "Unbounded",
  INSUFFICIENT_DATA: "Insuff. data",
  SPEC_CHANGED:      "Spec changed",
};

const ACTIONABLE_STATUSES = new Set<WorkloadRecommendation["status"]>([
  "WASTEFUL", "UNDER_PROVISIONED", "MIXED", "OPTIMAL", "UNBOUNDED",
]);

function WorkloadRow({
  workload,
  customerId,
  clusterId,
  isNew,
  selected,
  onToggle,
}: {
  workload: WorkloadRecommendation;
  customerId: number;
  clusterId: number;
  isNew?: boolean;
  selected?: boolean;
  onToggle?: (id: number) => void;
}) {
  const fmt = useFormatCurrency()
  const stale = isWorkloadStale(workload.last_seen_at);
  const actionable = ACTIONABLE_STATUSES.has(workload.status);
  return (
    <div
      className={cn(
        "flex items-center gap-3 hover:bg-neutral-50 transition-colors group",
        isNew && "animate-workload-enter",
      )}
    >
      {onToggle && (
        <div className="pl-4 shrink-0 flex items-center">
          {actionable ? (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggle(workload.workload_id)}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 accent-[#2563AF] cursor-pointer"
            />
          ) : (
            <div className="w-3.5 h-3.5" />
          )}
        </div>
      )}
      <Link
        to={`/customers/${customerId}/clusters/${clusterId}/workloads/${workload.workload_id}`}
        className="flex-1 flex items-center gap-4 px-4 py-4 min-w-0"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 truncate">
              {workload.name}
            </span>
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-sm bg-rose-500 shrink-0 transition-opacity duration-700",
                stale ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
              title="No data received in the last minute — excluded from recommendations after 15 min"
            />
            <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
              {workload.kind}
            </span>
            {workload.is_system && (
              <span title="System workload" className="shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors cursor-default">
                <Cog size={12} />
              </span>
            )}
            {workload.stability === "VARIABLE" && (
              <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                variable
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">{workload.namespace}</p>
        </div>
        <div className="text-right shrink-0 w-36">
          <p className="text-xs text-neutral-400 mb-0.5">CPU</p>
          <p className="text-xs flex items-center justify-end gap-1">
            {workload.cpu_status === "UNBOUNDED"
              ? <span className="text-neutral-400">—</span>
              : <span className="text-rose-400 line-through">{fmtCpu(workload.cpu_request_current)}</span>}
            <span className="text-neutral-300">→</span>
            <span className="text-emerald-600">{fmtCpu(workload.cpu_recommended)}</span>
          </p>
        </div>
        <div className="text-right shrink-0 w-36">
          <p className="text-xs text-neutral-400 mb-0.5">RAM</p>
          <p className="text-xs flex items-center justify-end gap-1">
            {workload.ram_status === "UNBOUNDED"
              ? <span className="text-neutral-400">—</span>
              : <span className="text-rose-400 line-through">{fmtRam(workload.ram_request_current)}</span>}
            <span className="text-neutral-300">→</span>
            <span className="text-emerald-600">{fmtRam(workload.ram_recommended)}</span>
          </p>
        </div>
        <div className="text-right shrink-0 w-24">
          <p className="text-xs text-neutral-400 mb-0.5">Savings</p>
          <p className="text-xs font-semibold text-emerald-600">
            {workload.status === "UNBOUNDED" ? "—" : `${fmt(workload.monthly_savings)}/mo`}
          </p>
        </div>
        <div className="shrink-0 w-24 text-right">
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              STATUS_STYLE[workload.status],
            )}
          >
            {STATUS_LABEL[workload.status]}
          </span>
        </div>
        <ArrowRight
          size={14}
          className="text-neutral-300 group-hover:text-neutral-600 transition-colors shrink-0"
        />
      </Link>
    </div>
  );
}

function PendingRow({
  workload,
  customerId,
  clusterId,
  isNew,
  flashSample,
  muted,
}: {
  workload: PendingWorkload;
  customerId: number;
  clusterId: number;
  isNew?: boolean;
  flashSample?: boolean;
  muted?: boolean;
}) {
  const stale = isWorkloadStale(workload.last_seen_at);
  const progress = Math.round(
    (workload.sample_count / workload.samples_required) * 100,
  );
  return (
    <Link
      to={`/customers/${customerId}/clusters/${clusterId}/workloads/${workload.workload_id}`}
      className={cn(
        "flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors group",
        isNew && "animate-workload-enter",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-500">
            {workload.name}
          </span>
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-sm bg-rose-500 shrink-0 transition-opacity duration-700",
              stale ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            title="No data received in the last minute — excluded from recommendations after 15 min"
          />
          <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
            {workload.kind}
          </span>
          {workload.is_system && (
            <span title="System workload" className="shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors cursor-default">
              <Cog size={12} />
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">{workload.namespace}</p>
      </div>
      <div className="shrink-0 w-48">
        <div className="flex items-center justify-between mb-1">
          <span
            className={cn(
              "text-xs font-medium",
              muted ? "text-neutral-400" : "text-emerald-600",
            )}
          >
            {progress}%
          </span>
          <span className="text-xs text-neutral-400">
            <span className={cn(flashSample && "animate-sample-flash")}>
              {workload.sample_count}
            </span>
            {" / "}
            {workload.samples_required} samples
          </span>
        </div>
        <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              muted ? "bg-neutral-300" : "bg-emerald-400",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ArrowRight
        size={14}
        className="text-neutral-300 group-hover:text-neutral-600 transition-colors shrink-0"
      />
    </Link>
  );
}

// ─── ClusterPage ──────────────────────────────────────────────────────────────

export default function ClusterPage() {
  const { id, cid } = useParams<{ id: string; cid: string }>();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const s = localStorage.getItem("time_window");
    return (["1d", "7d", "30d"] as TimeWindow[]).includes(s as TimeWindow)
      ? (s as TimeWindow)
      : "7d";
  });
  const [granularity, setGranularity] = useState<GranularityView>("hour");
  const [dayMode, setDayMode] = useState<"all" | "range">("all");
  const [workloadSort, setWorkloadSort] = useState<WorkloadSort>(() => {
    const s = localStorage.getItem("workload_sort");
    return WORKLOAD_SORT_OPTIONS.some((o) => o.value === s)
      ? (s as WorkloadSort)
      : "name";
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const s = localStorage.getItem("workload_sort_dir");
    return s === "asc" || s === "desc" ? s : "asc";
  });
  const [hideSystem, setHideSystem] = useState(
    () => localStorage.getItem("hide_system") === "true",
  );
  const [hideSystemChart, setHideSystemChart] = useState(
    () => localStorage.getItem("hide_system_chart") === "true",
  );
  const [excludeSystemFromSavings, setExcludeSystemFromSavings] = useState(
    () => localStorage.getItem("exclude_system_savings") === "true",
  );
  const [hourDay, setHourDay] = useState(() => todayStr());
  const [rangeFrom, setRangeFrom] = useState(() => daysAgoStr(7));
  const [rangeTo, setRangeTo] = useState(() => todayStr());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const apply = useApplyRecommendation();

  function navigateDay(dir: -1 | 1) {
    const d = new Date(hourDay + "T00:00:00");
    d.setDate(d.getDate() + dir);
    setHourDay(localDateStr(d));
  }

  const customerId = Number(id);
  const clusterId = Number(cid);

  const dateRange = useMemo(() => {
    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      const isToday = hourDay === todayStr();
      const to = isToday ? new Date() : new Date(d.getTime() + 86_400_000 + 3_600_000);
      return { from: d.toISOString(), to: to.toISOString() };
    }
    if (dayMode === "range" && rangeFrom && rangeTo) {
      const to = new Date(rangeTo);
      to.setDate(to.getDate() + 1);
      return { from: new Date(rangeFrom).toISOString(), to: to.toISOString() };
    }
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [granularity, hourDay, dayMode, rangeFrom, rangeTo]);

  const metricsParams = useMemo(
    () => ({ customerId, clusterId, ...dateRange, granularity }),
    [customerId, clusterId, dateRange, granularity],
  );

  const fmt = useFormatCurrency()
  const summary = useClusterSummary(customerId, clusterId, timeWindow);
  const metrics = useClusterMetrics(metricsParams);
  const recommendations = useClusterRecommendations(
    customerId,
    clusterId,
    timeWindow,
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, [timeWindow]);

  const prevIdsRef = useRef<Set<number> | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!recommendations.data) return;
    const current = new Set([
      ...recommendations.data.workloads.map((w) => w.workload_id),
      ...recommendations.data.pending_workloads.map((w) => w.workload_id),
    ]);
    if (prevIdsRef.current !== null) {
      const fresh = [...current].filter((id) => !prevIdsRef.current!.has(id));
      if (fresh.length > 0) {
        setNewIds(new Set(fresh));
        const t = setTimeout(() => setNewIds(new Set()), 400);
        prevIdsRef.current = current;
        return () => clearTimeout(t);
      }
    }
    prevIdsRef.current = current;
  }, [recommendations.data]);

  const prevSampleCountsRef = useRef<Map<number, number> | null>(null);
  const [flashingSamples, setFlashingSamples] = useState<Set<number>>(
    new Set(),
  );

  useEffect(() => {
    if (!recommendations.data) return;
    const current = new Map(
      recommendations.data.pending_workloads.map((w) => [
        w.workload_id,
        w.sample_count,
      ]),
    );
    if (prevSampleCountsRef.current !== null) {
      const flashing: number[] = [];
      for (const [id, count] of current) {
        const prev = prevSampleCountsRef.current.get(id);
        if (prev !== undefined && count > prev) flashing.push(id);
      }
      if (flashing.length > 0) {
        startTransition(() => setFlashingSamples(new Set(flashing)));
        const t = setTimeout(() => setFlashingSamples(new Set()), 1100);
        prevSampleCountsRef.current = current;
        return () => clearTimeout(t);
      }
    }
    prevSampleCountsRef.current = current;
  }, [recommendations.data]);


  function toChartPoints(points: MetricPoint[], granularity: GranularityView, hourDay: string): ChartPoint[] {
    if (granularity === "hour") {
      const dayEnd = new Date(hourDay + "T00:00:00").getTime() + 86_400_000;
      return points
        .filter((p) => new Date(p.ts).getTime() <= dayEnd)
        .map((p) => ({ ...p, ts_ms: new Date(p.ts).getTime() }));
    }
    return points.map((p) => ({ ...p, ts_ms: new Date(p.ts).getTime() }));
  }

  const chartData = useMemo<ChartPoint[]>(
    () => toChartPoints(metrics.data?.app_points ?? [], granularity, hourDay),
    [metrics.data, granularity, hourDay],
  );

  const systemChartData = useMemo<ChartPoint[]>(
    () => toChartPoints(metrics.data?.system_points ?? [], granularity, hourDay),
    [metrics.data, granularity, hourDay],
  );

  const xDomain = useMemo((): [number | string, number | string] => {
    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      return [d.getTime(), d.getTime() + 86_400_000 + 1];
    }
    if (dayMode === "range" && rangeFrom && rangeTo) {
      return [
        new Date(rangeFrom).getTime(),
        new Date(rangeTo).getTime() + 86_400_000,
      ];
    }
    return ["dataMin", "dataMax"];
  }, [granularity, hourDay, dayMode, rangeFrom, rangeTo]);

  const futureFromMs =
    granularity === "hour" && hourDay === todayStr() ? now : undefined;

  const hourTicks = useMemo(() => {
    if (granularity !== "hour") return undefined;
    const start = xDomain[0] as number;
    return Array.from({ length: 7 }, (_, i) => start + i * 4 * 60 * 60 * 1000);
  }, [granularity, xDomain]);

  const hourDayEndMs =
    granularity === "hour" ? (xDomain[0] as number) + 86_400_000 : 0;
  const tickFormatter =
    granularity === "hour"
      ? (v: number) => (v >= hourDayEndMs ? "24:00" : fmtTime(v))
      : fmtDate;
  const tickCount = granularity === "hour" ? 7 : 6;

  const displayedTotalSavings = useMemo(() => {
    if (!recommendations.data) return 0;
    if (hideSystem && excludeSystemFromSavings) {
      return recommendations.data.workloads
        .filter((w) => !w.is_system)
        .reduce((sum, w) => sum + w.monthly_savings, 0);
    }
    return recommendations.data.total_monthly_savings;
  }, [recommendations.data, hideSystem, excludeSystemFromSavings]);

  const costOverview = useMemo(() => {
    if (!summary.data) return null;
    if (!excludeSystemFromSavings || !recommendations.data) {
      return {
        monthly_cost_current: summary.data.monthly_cost_current,
        monthly_cost_recommended: summary.data.monthly_cost_recommended,
        monthly_savings: summary.data.monthly_savings,
      };
    }
    const appWorkloads = recommendations.data.workloads.filter((w) => !w.is_system);
    return {
      monthly_cost_current: appWorkloads.reduce((sum, w) => sum + w.monthly_cost_current, 0),
      monthly_cost_recommended: appWorkloads.reduce((sum, w) => sum + w.monthly_cost_recommended, 0),
      monthly_savings: appWorkloads.reduce((sum, w) => sum + w.monthly_savings, 0),
    };
  }, [summary.data, recommendations.data, excludeSystemFromSavings]);

  const activeWorkloads =
    recommendations.data?.workloads.filter(
      (w) => !isWorkloadStale(w.last_seen_at) && (!hideSystem || !w.is_system),
    ) ?? [];
  const lostWorkloads =
    recommendations.data?.workloads.filter(
      (w) => isWorkloadStale(w.last_seen_at) && (!hideSystem || !w.is_system),
    ) ?? [];
  const activePending =
    recommendations.data?.pending_workloads.filter(
      (w) => !isWorkloadStale(w.last_seen_at) && (!hideSystem || !w.is_system),
    ) ?? [];
  const lostPending =
    recommendations.data?.pending_workloads.filter(
      (w) => isWorkloadStale(w.last_seen_at) && (!hideSystem || !w.is_system),
    ) ?? [];

  if (
    !id ||
    !cid ||
    isNaN(customerId) ||
    isNaN(clusterId) ||
    customerId <= 0 ||
    clusterId <= 0
  ) {
    return <Navigate to="/customers" replace />;
  }

  const wb = summary.data?.workload_breakdown;

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <Link
        to={`/customers/${customerId}`}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-6"
      >
        <ArrowLeft size={12} />
        Customer
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900">
            {summary.data?.name ?? "—"}
          </h1>
          {summary.data && (
            <>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded font-medium",
                PROVIDER_STYLE[summary.data.provider] ?? "text-neutral-400 bg-neutral-100",
              )}>
                {summary.data.provider}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  summary.data.status === "active"
                    ? "text-emerald-600"
                    : summary.data.status === "pending"
                      ? "text-amber-600"
                      : "text-neutral-400",
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full inline-block",
                    summary.data.status === "active"
                      ? "bg-emerald-400"
                      : summary.data.status === "pending"
                        ? "bg-amber-300"
                        : "bg-neutral-300",
                  )}
                />
                {summary.data.status}
              </span>
              <span className="text-xs text-neutral-400">
                updated {fmtRelativeTime(summary.data.generated_at, now)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {summary.error && (
        <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">
            {getErrorCode(summary.error) === "DB_UNAVAILABLE"
              ? "Service is temporarily unavailable."
              : getErrorCode(summary.error) === "ACCESS_DENIED"
                ? "You do not have access to this cluster."
                : getErrorCode(summary.error) === "CLUSTER_NOT_FOUND"
                  ? "Cluster not found."
                  : "Failed to load cluster data."}
          </p>
        </div>
      )}

      {/* Stats skeleton */}
      {summary.isLoading && (
        <div className="border border-neutral-100 rounded-xl mb-8 animate-pulse">
          <div className="px-6 py-3 border-b border-neutral-100">
            <div className="h-3 w-24 bg-neutral-100 rounded" />
          </div>
          <div className="grid grid-cols-3 divide-x divide-neutral-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-6">
                <div className="h-3 w-24 bg-neutral-100 rounded mb-3" />
                <div className="h-7 w-32 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats cards */}
      {summary.data && (
        <div className="bg-white border border-neutral-100 rounded-xl mb-8">
          <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Cost Overview</p>
            <div className="flex items-center gap-1 bg-white/50 border border-white/60 rounded-lg p-1">
              {TIME_WINDOWS.map(({ label, value, diagnostic }) => (
                <button
                  key={value}
                  onClick={() => {
                    setTimeWindow(value);
                    localStorage.setItem("time_window", value);
                  }}
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
          <div className="grid grid-cols-3 divide-x divide-neutral-100">
            <div className="p-6">
              <div className="flex items-center gap-1 mb-2">
                <p className="text-xs text-neutral-400 uppercase tracking-wide">
                  Current Monthly Price
                </p>
                <div className="relative group/tip">
                  <Info size={11} className="text-neutral-300 cursor-default" />
                  <div className="absolute bottom-full left-0 mb-2 w-60 px-3 py-2 bg-neutral-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed">
                    Estimated monthly cost based on the current resource requests of all active workloads and their pod counts.
                  </div>
                </div>
              </div>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={costOverview?.monthly_cost_current ?? 0} />
                <span className="text-sm font-normal text-neutral-400 ml-1">
                  /mo
                </span>
              </p>
            </div>
            <div className="p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
                Recommended
              </p>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={costOverview?.monthly_cost_recommended ?? 0} />
                <span className="text-sm font-normal text-neutral-400 ml-1">
                  /mo
                </span>
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-1 mb-2">
                <p className="text-xs text-neutral-400 uppercase tracking-wide">
                  {savingsLabel()}
                </p>
                <div className="relative group/tip">
                  <Info size={11} className="text-neutral-300 cursor-default" />
                  <div className="absolute bottom-full right-0 mb-2 w-60 px-3 py-2 bg-neutral-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed">
                    Projected monthly savings based on <span className="font-medium">{timeWindow}</span> of usage data. Recent changes to workload behavior may take a full {timeWindow} window to be reflected.
                  </div>
                </div>
              </div>
              <p className="text-2xl font-semibold text-emerald-600">
                <AnimatedCurrency value={costOverview?.monthly_savings ?? 0} />
                <span className="text-sm font-normal text-neutral-400 ml-1">
                  /mo
                </span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {formatSavingsPercent(
                  costOverview?.monthly_cost_current ?? 0,
                  costOverview?.monthly_savings ?? 0,
                )}{" "}
                reduction
              </p>
              {summary.data.workload_breakdown.insufficient_data > 0 && (
                <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 inline-block shrink-0" />
                  {summary.data.workload_breakdown.insufficient_data} insufficient
                  data
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workload breakdown dots */}
      {wb && (
        <div className="flex items-center gap-3 mb-8">
          {wb.wasteful > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
              {wb.wasteful} wasteful
            </span>
          )}
          {wb.under_provisioned > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
              {wb.under_provisioned} under-provisioned
            </span>
          )}
          {wb.mixed > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
              {wb.mixed} mixed
            </span>
          )}
          {wb.unbounded > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              {wb.unbounded} unbounded
            </span>
          )}
          {wb.optimal > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {wb.optimal} optimal
            </span>
          )}
          {wb.loading > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-200 inline-block" />
              {wb.loading} loading
            </span>
          )}
        </div>
      )}

      {/* Metrics card */}
      <div className="bg-white border border-neutral-100 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Resource Usage
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setHideSystemChart((h) => {
                  const next = !h;
                  localStorage.setItem("hide_system_chart", String(next));
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                hideSystemChart
                  ? "text-neutral-900 bg-neutral-100 border-neutral-300"
                  : "text-neutral-400 border-neutral-200 hover:text-neutral-700",
              )}
            >
              <Cog size={11} />
              {hideSystemChart ? "Show system" : "Hide system"}
            </button>
            <div className="flex items-center gap-1 bg-white/50 border border-white/60 rounded-lg p-1">
            {GRANULARITY_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setGranularity(value)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  granularity === value
                    ? "bg-[#2563AF]/10 text-[#2563AF]"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
              >
                {label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {granularity === "hour" && (
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => navigateDay(-1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:shadow-lg hover:border-[#5AC9E9]/40 transition-colors"
            >
              <ArrowLeft size={12} />
            </button>
            <DatePicker
              value={hourDay}
              max={todayStr()}
              onChange={setHourDay}
              label={hourDay === todayStr() ? "Today" : undefined}
            />
            <button
              onClick={() => navigateDay(1)}
              disabled={hourDay >= todayStr()}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:shadow-lg hover:border-[#5AC9E9]/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {granularity === "day" && (
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setDayMode("all")}
              className={cn(
                "text-xs font-medium transition-colors",
                dayMode === "all"
                  ? "text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700",
              )}
            >
              All
            </button>
            <span className="text-neutral-200 select-none">·</span>
            <div
              onClick={() => setDayMode("range")}
              className={cn(
                "flex items-center gap-2 transition-opacity",
                dayMode === "range"
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70",
              )}
            >
              <DatePicker
                value={rangeFrom}
                min={daysAgoStr(30)}
                max={rangeTo}
                onChange={(v) => {
                  setRangeFrom(v);
                  setDayMode("range");
                }}
              />
              <span className="text-neutral-300 text-xs">→</span>
              <DatePicker
                value={rangeTo}
                min={rangeFrom}
                max={todayStr()}
                onChange={(v) => {
                  setRangeTo(v);
                  setDayMode("range");
                }}
              />
            </div>
          </div>
        )}

        {metrics.isLoading && (
          <div className="space-y-6">
            <div className="h-36 bg-neutral-50 rounded-lg animate-pulse" />
            <div className="h-36 bg-neutral-50 rounded-lg animate-pulse" />
          </div>
        )}

        {metrics.data && (
          <div className={cn("relative z-0 space-y-8 transition-opacity duration-300", metrics.isFetching ? "opacity-40" : "opacity-100")}>
            <MetricChart
              appData={chartData}
              systemData={hideSystemChart ? undefined : systemChartData}
              dataKey="cpu_cores"
              label="CPU (cores)"
              valueFormatter={(v) => v.toFixed(2)}
              domain={xDomain}
              tickFormatter={tickFormatter}
              tickCount={tickCount}
              ticks={hourTicks}
              accent={granularity === "hour"}
              futureFrom={futureFromMs}
            />
            <MetricChart
              appData={chartData}
              systemData={hideSystemChart ? undefined : systemChartData}
              dataKey="ram_bytes"
              label="RAM"
              valueFormatter={(v) => formatBytes(v)}
              domain={xDomain}
              tickFormatter={tickFormatter}
              tickCount={tickCount}
              ticks={hourTicks}
              accent={granularity === "hour"}
              futureFrom={futureFromMs}
            />
            {chartData.length === 0 && (
              <p className="text-xs text-neutral-400">No metrics data for this period.</p>
            )}
          </div>
        )}
        {metrics.error && (
          <p className="text-sm text-red-400">Failed to load metrics.</p>
        )}
      </div>

      {/* Active workload recommendations */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Workloads
            {recommendations.data && ` · ${activeWorkloads.length}`}
          </h2>
          <div className="flex items-center gap-3">
            {selectionMode ? (
              <>
                <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
                  {[
                    { label: "All",    filter: (_w: WorkloadRecommendation) => true },
                    { label: "App",    filter: (w: WorkloadRecommendation) => !w.is_system },
                    { label: "System", filter: (w: WorkloadRecommendation) => w.is_system },
                  ].map(({ label, filter }) => (
                    <button
                      key={label}
                      onClick={() => {
                        const ids = activeWorkloads
                          .filter((w) => ACTIONABLE_STATUSES.has(w.status) && filter(w))
                          .map((w) => w.workload_id);
                        setSelected(new Set(ids));
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:bg-white transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <>
                    <span className="text-xs text-neutral-500">{selected.size} selected</span>
                    <button
                      onClick={() => setShowApplyModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#2563AF] text-white text-xs font-medium hover:bg-[#1d4ed8] transition-colors"
                    >
                      Review & Apply
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setSelectionMode(false); setSelected(new Set()); }}
                  className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectionMode(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Optimize
              </button>
            )}
            {recommendations.data && displayedTotalSavings > 0 && (
              <span className="text-xs text-emerald-600 font-medium">
                {fmt(displayedTotalSavings)}/mo total savings
              </span>
            )}
            <button
              onClick={() =>
                setHideSystem((h) => {
                  const next = !h;
                  localStorage.setItem("hide_system", String(next));
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                hideSystem
                  ? "text-neutral-900 bg-neutral-100 border-neutral-300"
                  : "text-neutral-400 border-neutral-200 hover:text-neutral-700",
              )}
            >
              <Cog size={11} />
              {hideSystem ? "Showing app only" : "Hide system"}
            </button>
            {hideSystem && (
              <label className="inline-flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeSystemFromSavings}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setExcludeSystemFromSavings(next);
                    localStorage.setItem("exclude_system_savings", String(next));
                  }}
                  className="w-3 h-3 accent-neutral-800 cursor-pointer"
                />
                Excl. system from totals
              </label>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSortDir((d) => {
                    const next = d === "asc" ? "desc" : "asc";
                    localStorage.setItem("workload_sort_dir", next);
                    return next;
                  })
                }
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:shadow-lg hover:border-[#5AC9E9]/40 transition-colors"
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                {sortDir === "asc" ? (
                  <ArrowDown size={11} />
                ) : (
                  <ArrowUp size={11} />
                )}
              </button>
              <div className="relative">
                <select
                  value={workloadSort}
                  onChange={(e) => {
                    const v = e.target.value as WorkloadSort;
                    setWorkloadSort(v);
                    localStorage.setItem("workload_sort", v);
                  }}
                  className="appearance-none text-xs text-neutral-600 bg-white border border-neutral-200 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-300 cursor-pointer"
                >
                  {WORKLOAD_SORT_OPTIONS.map(({ label, value }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400"
                />
              </div>
            </div>
          </div>
        </div>

        {recommendations.error && (
          <p className="text-sm text-red-400">Failed to load workloads.</p>
        )}

        {recommendations.isLoading && (
          <div className="space-y-1">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-neutral-50 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {activeWorkloads.length > 0 &&
          (GROUPED_SORTS.includes(workloadSort) ? (
            <div className="space-y-5">
              {groupBy(
                sortItems(activeWorkloads, workloadSort, sortDir),
                sectionKey(workloadSort),
                sortDir,
              ).map(([section, items]) => (
                <div key={section}>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </p>
                  <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
                    {items.map((w) => (
                      <WorkloadRow
                        key={w.workload_id}
                        workload={w}
                        customerId={customerId}
                        clusterId={clusterId}
                        isNew={newIds.has(w.workload_id)}
                        selected={selected.has(w.workload_id)}
                        onToggle={selectionMode ? (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
              {sortItems(activeWorkloads, workloadSort, sortDir).map((w) => (
                <WorkloadRow
                  key={w.workload_id}
                  workload={w}
                  customerId={customerId}
                  clusterId={clusterId}
                  isNew={newIds.has(w.workload_id)}
                  selected={selected.has(w.workload_id)}
                  onToggle={selectionMode ? (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }) : undefined}
                />
              ))}
            </div>
          ))}

        {recommendations.data &&
          activeWorkloads.length === 0 &&
          lostWorkloads.length === 0 && (
            <p className="text-sm text-neutral-400">
              No recommendations for this window.
            </p>
          )}
      </div>

      {/* Active pending workloads */}
      {activePending.length > 0 && (
        <div className="mb-6">
          {GROUPED_SORTS.includes(workloadSort) ? (
            <div className="space-y-5">
              {groupBy(
                sortItems(activePending, workloadSort, sortDir),
                sectionKey(workloadSort),
                sortDir,
              ).map(([section, items]) => (
                <div key={section}>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    Pending ·{" "}
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </p>
                  <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
                    {items.map((w) => (
                      <PendingRow
                        key={w.workload_id}
                        workload={w}
                        customerId={customerId}
                        clusterId={clusterId}
                        isNew={newIds.has(w.workload_id)}
                        flashSample={flashingSamples.has(w.workload_id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-4">
                Pending · {activePending.length}
              </h2>
              <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
                {sortItems(activePending, workloadSort, sortDir).map((w) => (
                  <PendingRow
                    key={w.workload_id}
                    workload={w}
                    customerId={customerId}
                    clusterId={clusterId}
                    isNew={newIds.has(w.workload_id)}
                    flashSample={flashingSamples.has(w.workload_id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Lost Connection — reporting stopped >1 min ago, backend still tracking */}
      {(lostWorkloads.length > 0 || lostPending.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
              Lost Connection ·{" "}
              {lostWorkloads.length + lostPending.length}
            </h2>
            <span className="text-xs text-neutral-400">
              no data in 1 min · removed from recommendations after 15 min
            </span>
          </div>
          {GROUPED_SORTS.includes(workloadSort) ? (
            <div className="space-y-5">
              {lostWorkloads.length > 0 &&
                groupBy(
                  sortItems(lostWorkloads, workloadSort, sortDir),
                  sectionKey(workloadSort),
                  sortDir,
                ).map(([section, items]) => (
                  <div key={section}>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                      {section.charAt(0).toUpperCase() + section.slice(1)}
                    </p>
                    <div className="bg-white border border-rose-100 rounded-xl divide-y divide-neutral-100 opacity-60">
                      {items.map((w) => (
                        <WorkloadRow
                          key={w.workload_id}
                          workload={w}
                          customerId={customerId}
                          clusterId={clusterId}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              {lostPending.length > 0 &&
                groupBy(
                  sortItems(lostPending, workloadSort, sortDir),
                  sectionKey(workloadSort),
                  sortDir,
                ).map(([section, items]) => (
                  <div key={`pending-${section}`}>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                      Pending ·{" "}
                      {section.charAt(0).toUpperCase() + section.slice(1)}
                    </p>
                    <div className="bg-white border border-rose-100 rounded-xl divide-y divide-neutral-100 opacity-60">
                      {items.map((w) => (
                        <PendingRow
                          key={w.workload_id}
                          workload={w}
                          customerId={customerId}
                          clusterId={clusterId}
                          flashSample={flashingSamples.has(w.workload_id)}
                          muted
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-white border border-rose-100 rounded-xl divide-y divide-neutral-100 opacity-60">
              {sortItems(lostWorkloads, workloadSort, sortDir).map((w) => (
                <WorkloadRow
                  key={w.workload_id}
                  workload={w}
                  customerId={customerId}
                  clusterId={clusterId}
                />
              ))}
              {sortItems(lostPending, workloadSort, sortDir).map((w) => (
                <PendingRow
                  key={w.workload_id}
                  workload={w}
                  customerId={customerId}
                  clusterId={clusterId}
                  flashSample={flashingSamples.has(w.workload_id)}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply recommendations modal */}
      {showApplyModal && (() => {
        const selectedWorkloads = activeWorkloads.filter((w) => selected.has(w.workload_id));
        const totalSavings = selectedWorkloads
          .filter((w) => w.status !== "UNBOUNDED")
          .reduce((sum, w) => sum + w.monthly_savings, 0);

        async function handleApply() {
          setApplying(true);
          await Promise.allSettled(
            selectedWorkloads.map((w) =>
              apply.mutateAsync({ customerId, clusterId, workloadId: w.workload_id, window: timeWindow }),
            ),
          );
          setApplying(false);
          setSelected(new Set());
          setShowApplyModal(false);
        }

        return (
          <Dialog title="Apply Recommendations" onClose={() => !applying && setShowApplyModal(false)} size="lg">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg mb-5 -mt-2 text-xs text-amber-700">
              <span>
                Applying will reset sample collection for the selected window. Sample counts restart from 0 after each application — recommendations will be unavailable until enough new samples are collected.
              </span>
            </div>
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left text-neutral-400 font-medium pb-2">Workload</th>
                    <th className="text-right text-neutral-400 font-medium pb-2 pl-4">CPU</th>
                    <th className="text-right text-neutral-400 font-medium pb-2 pl-4">RAM</th>
                    <th className="text-right text-neutral-400 font-medium pb-2 pl-4">Savings/mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {selectedWorkloads.map((w) => (
                    <tr key={w.workload_id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-neutral-800">{w.name}</p>
                        <p className="text-neutral-400">{w.namespace}</p>
                      </td>
                      <td className="py-2.5 pl-4 text-right font-mono whitespace-nowrap">
                        <span className="text-neutral-400">{fmtCpu(w.cpu_request_current)}</span>
                        <span className="mx-1 text-neutral-300">→</span>
                        <span className="text-emerald-600">{fmtCpu(w.cpu_recommended)}</span>
                      </td>
                      <td className="py-2.5 pl-4 text-right font-mono whitespace-nowrap">
                        <span className="text-neutral-400">{fmtRam(w.ram_request_current)}</span>
                        <span className="mx-1 text-neutral-300">→</span>
                        <span className="text-emerald-600">{fmtRam(w.ram_recommended)}</span>
                      </td>
                      <td className="py-2.5 pl-4 text-right font-medium text-emerald-600 whitespace-nowrap">
                        {w.status === "UNBOUNDED" ? "—" : `${fmt(w.monthly_savings)}/mo`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalSavings > 0 && (
                  <tfoot>
                    <tr className="border-t border-neutral-100">
                      <td colSpan={3} className="pt-2.5 text-neutral-400">Total potential savings</td>
                      <td className="pt-2.5 text-right font-semibold text-emerald-600">{fmt(totalSavings)}/mo</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApplyModal(false)}
                disabled={applying}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-500 hover:text-neutral-700 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-1.5 rounded-lg bg-[#2563AF] text-white text-xs font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
              >
                {applying ? "Applying…" : `Apply ${selectedWorkloads.length} workload${selectedWorkloads.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </Dialog>
        );
      })()}
    </div>
  );
}
