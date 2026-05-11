import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
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
import {
  formatCurrency,
  formatBytes,
  formatSavingsPercent,
} from "@/lib/format";
import { getErrorCode } from "@/lib/api";
import { cn } from "@/lib/utils";
import AnimatedCurrency from "@/components/AnimatedCurrency";
import type { TimeWindow } from "@/types/dashboard";
import type {
  MetricPoint,
  WorkloadRecommendation,
  PendingWorkload,
} from "@/types/cluster";

// ─── constants ────────────────────────────────────────────────────────────────

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: "1d", value: "1d" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

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

function currentUserFromToken(): string {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.sub ?? payload.email ?? "");
  } catch {
    return "";
  }
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
  const ref = useRef<HTMLInputElement>(null);

  function open() {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <span
      onClick={open}
      className={cn(
        "text-xs text-neutral-700 border-b border-neutral-200 pb-px cursor-pointer select-none hover:border-neutral-400 transition-colors",
        className,
      )}
    >
      {label ?? fmtDateInput(value)}
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </span>
  );
}

type ChartPoint = MetricPoint & { ts_ms: number };

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
  data: ChartPoint[];
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
  data,
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
  return (
    <div>
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
        {label}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={data}
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
              const val = entry.value as number;
              const ts = (entry.payload as ChartPoint).ts_ms;
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
                  <p style={{ color: "#a3a3a3", marginBottom: 2 }}>
                    {new Date(ts).toLocaleString()}
                  </p>
                  <p style={{ color: "#171717" }}>{valueFormatter(val)}</p>
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
            dot={false}
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

type WorkloadSort = "name" | "samples" | "kind" | "namespace";
type SortDir = "asc" | "desc";

const WORKLOAD_SORT_OPTIONS: { label: string; value: WorkloadSort }[] = [
  { label: "Name", value: "name" },
  { label: "Samples", value: "samples" },
  { label: "Workload type", value: "kind" },
  { label: "Group", value: "namespace" },
];

const GROUPED_SORTS: WorkloadSort[] = ["kind", "namespace"];

type Sortable = {
  name: string;
  namespace: string;
  kind: string;
  sample_count: number;
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
  return sort === "kind" ? (i) => i.kind : (i) => i.namespace;
}

function isWorkloadStale(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() > 60_000;
}

// ─── WorkloadRow / PendingRow ─────────────────────────────────────────────────

const STATUS_STYLE: Record<WorkloadRecommendation["status"], string> = {
  WASTEFUL: "text-rose-500 bg-rose-50",
  UNDER_PROVISIONED: "text-amber-600 bg-amber-50",
  OPTIMAL: "text-emerald-600 bg-emerald-50",
  INSUFFICIENT_DATA: "text-neutral-400 bg-neutral-100",
};

const STATUS_LABEL: Record<WorkloadRecommendation["status"], string> = {
  WASTEFUL: "Wasteful",
  UNDER_PROVISIONED: "Under-prov.",
  OPTIMAL: "Optimal",
  INSUFFICIENT_DATA: "Insuff. data",
};

function WorkloadRow({
  workload,
  customerId,
  clusterId,
  isNew,
}: {
  workload: WorkloadRecommendation;
  customerId: number;
  clusterId: number;
  isNew?: boolean;
}) {
  const stale = isWorkloadStale(workload.last_seen_at);
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
        <p className="text-xs text-neutral-700">
          <span className="text-neutral-400 line-through mr-1">
            {workload.cpu_request_current}
          </span>
          {workload.cpu_recommended}
        </p>
      </div>
      <div className="text-right shrink-0 w-36">
        <p className="text-xs text-neutral-400 mb-0.5">RAM</p>
        <p className="text-xs text-neutral-700">
          <span className="text-neutral-400 line-through mr-1">
            {workload.ram_request_current}
          </span>
          {workload.ram_recommended}
        </p>
      </div>
      <div className="text-right shrink-0 w-24">
        <p className="text-xs text-neutral-400 mb-0.5">Savings</p>
        <p className="text-xs font-semibold text-emerald-600">
          {formatCurrency(workload.monthly_savings)}/mo
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
  );
}

function PendingRow({
  workload,
  isNew,
  flashSample,
  muted,
}: {
  workload: PendingWorkload;
  isNew?: boolean;
  flashSample?: boolean;
  muted?: boolean;
}) {
  const stale = isWorkloadStale(workload.last_seen_at);
  const progress = Math.round(
    (workload.sample_count / workload.samples_required) * 100,
  );
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-6 py-4",
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
    </div>
  );
}

// ─── ClusterPage ──────────────────────────────────────────────────────────────

export default function ClusterPage() {
  const { id, cid } = useParams<{ id: string; cid: string }>();
  const currentUser = currentUserFromToken();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
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
  const [hourDay, setHourDay] = useState(() => todayStr());
  const [rangeFrom, setRangeFrom] = useState(() => daysAgoStr(7));
  const [rangeTo, setRangeTo] = useState(() => todayStr());

  const customerId = Number(id);
  const clusterId = Number(cid);

  const dateRange = useMemo(() => {
    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      const isToday = hourDay === todayStr();
      const to = isToday ? new Date() : new Date(d.getTime() + 86_400_000);
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

  const summary = useClusterSummary(customerId, clusterId, timeWindow);
  const metrics = useClusterMetrics(metricsParams);
  const recommendations = useClusterRecommendations(
    customerId,
    clusterId,
    timeWindow,
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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
        setFlashingSamples(new Set(flashing));
        const t = setTimeout(() => setFlashingSamples(new Set()), 1100);
        prevSampleCountsRef.current = current;
        return () => clearTimeout(t);
      }
    }
    prevSampleCountsRef.current = current;
  }, [recommendations.data]);

  type CachedEntry = {
    kind: "workload" | "pending";
    data: WorkloadRecommendation | PendingWorkload;
    cachedAt: number;
  };
  const [cachedOffline, setCachedOffline] = useState<CachedEntry[]>([]);

  useEffect(() => {
    if (!recommendations.data) return;
    const prefix = `workload:${currentUser}:${clusterId}:`;
    const now = Date.now();
    const curIds = new Set([
      ...recommendations.data.workloads.map((w) => w.workload_id),
      ...recommendations.data.pending_workloads.map((w) => w.workload_id),
    ]);
    for (const w of recommendations.data.workloads) {
      localStorage.setItem(
        `${prefix}${w.workload_id}`,
        JSON.stringify({ kind: "workload", data: w, cachedAt: now }),
      );
    }
    for (const w of recommendations.data.pending_workloads) {
      localStorage.setItem(
        `${prefix}${w.workload_id}`,
        JSON.stringify({ kind: "pending", data: w, cachedAt: now }),
      );
    }
    const offline: CachedEntry[] = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue;
      try {
        const e = JSON.parse(localStorage.getItem(key)!) as CachedEntry;
        if (now - e.cachedAt > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(key);
          continue;
        }
        if (!curIds.has(e.data.workload_id)) offline.push(e);
      } catch {
        localStorage.removeItem(key);
      }
    }
    setCachedOffline(offline);
  }, [recommendations.data, clusterId, currentUser]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      (metrics.data?.points ?? []).map((p) => ({
        ...p,
        ts_ms: new Date(p.ts).getTime(),
      })),
    [metrics.data],
  );

  const xDomain = useMemo((): [number | string, number | string] => {
    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      return [d.getTime(), d.getTime() + 86_400_000];
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
    granularity === "hour" && hourDay === todayStr() ? Date.now() : undefined;

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

  const activeWorkloads =
    recommendations.data?.workloads.filter(
      (w) => !isWorkloadStale(w.last_seen_at),
    ) ?? [];
  const lostWorkloads =
    recommendations.data?.workloads.filter((w) =>
      isWorkloadStale(w.last_seen_at),
    ) ?? [];
  const activePending =
    recommendations.data?.pending_workloads.filter(
      (w) => !isWorkloadStale(w.last_seen_at),
    ) ?? [];
  const lostPending =
    recommendations.data?.pending_workloads.filter((w) =>
      isWorkloadStale(w.last_seen_at),
    ) ?? [];

  const lostFromCache = cachedOffline.filter(
    (e) =>
      e.data.last_seen_at != null &&
      Date.now() - new Date(e.data.last_seen_at).getTime() <= 15 * 60_000,
  );
  const outOfRecsFromCache = cachedOffline.filter(
    (e) =>
      !e.data.last_seen_at ||
      Date.now() - new Date(e.data.last_seen_at).getTime() > 15 * 60_000,
  );

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
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
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
            </>
          )}
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {TIME_WINDOWS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTimeWindow(value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                timeWindow === value
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700",
              )}
            >
              {label}
            </button>
          ))}
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
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white border border-neutral-100 rounded-xl p-6 animate-pulse"
            >
              <div className="h-3 w-24 bg-neutral-100 rounded mb-3" />
              <div className="h-7 w-32 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Stats cards */}
      {summary.data && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-neutral-100 rounded-xl p-6">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
              Monthly Spend
            </p>
            <p className="text-2xl font-semibold text-neutral-900">
              <AnimatedCurrency value={summary.data.monthly_cost_current} />
              <span className="text-sm font-normal text-neutral-400 ml-1">
                /mo
              </span>
            </p>
          </div>
          <div className="bg-white border border-neutral-100 rounded-xl p-6">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
              Recommended
            </p>
            <p className="text-2xl font-semibold text-neutral-900">
              <AnimatedCurrency value={summary.data.monthly_cost_recommended} />
              <span className="text-sm font-normal text-neutral-400 ml-1">
                /mo
              </span>
            </p>
          </div>
          <div className="bg-white border border-neutral-100 rounded-xl p-6">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
              Monthly Savings
            </p>
            <p className="text-2xl font-semibold text-emerald-600">
              <AnimatedCurrency value={summary.data.monthly_savings} />
              <span className="text-sm font-normal text-neutral-400 ml-1">
                /mo
              </span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {formatSavingsPercent(
                summary.data.monthly_cost_current,
                summary.data.monthly_savings,
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
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {GRANULARITY_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setGranularity(value)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  granularity === value
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {granularity === "hour" && (
          <div className="flex items-center gap-3 mb-5">
            <DatePicker
              value={hourDay}
              max={todayStr()}
              onChange={setHourDay}
              label={hourDay === todayStr() ? "Today" : undefined}
            />
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

        {metrics.data && chartData.length > 0 && (
          <div className="space-y-8">
            <MetricChart
              data={chartData}
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
              data={chartData}
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
          </div>
        )}

        {metrics.data && chartData.length === 0 && (
          <p className="text-sm text-neutral-400">
            No metrics data for this period.
          </p>
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
            {recommendations.data &&
              recommendations.data.total_monthly_savings > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  {formatCurrency(recommendations.data.total_monthly_savings)}
                  /mo total savings
                </span>
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
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:border-neutral-300 transition-colors"
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
                />
              ))}
            </div>
          ))}

        {recommendations.data &&
          activeWorkloads.length === 0 &&
          lostWorkloads.length === 0 &&
          lostFromCache.length === 0 &&
          outOfRecsFromCache.length === 0 && (
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
      {(lostWorkloads.length > 0 ||
        lostPending.length > 0 ||
        lostFromCache.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
              Lost Connection ·{" "}
              {lostWorkloads.length + lostPending.length + lostFromCache.length}
            </h2>
            <span className="text-xs text-neutral-400">
              no data in 1 min · removed from recommendations after 15 min
            </span>
          </div>
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
                flashSample={flashingSamples.has(w.workload_id)}
                muted
              />
            ))}
            {lostFromCache
              .filter((e) => e.kind === "workload")
              .map((e) => (
                <WorkloadRow
                  key={e.data.workload_id}
                  workload={e.data as WorkloadRecommendation}
                  customerId={customerId}
                  clusterId={clusterId}
                />
              ))}
            {lostFromCache
              .filter((e) => e.kind === "pending")
              .map((e) => (
                <PendingRow
                  key={e.data.workload_id}
                  workload={e.data as PendingWorkload}
                  muted
                />
              ))}
          </div>
        </div>
      )}

      {/* Out of Recommendations — backend has stopped reporting, tracking resumes within 7 days */}
      {outOfRecsFromCache.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
              Out of Recommendations · {outOfRecsFromCache.length}
            </h2>
            <span className="text-xs text-neutral-400">
              excluded by backend · tracking resumes if seen within 7 days
            </span>
          </div>
          <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100 opacity-40">
            {outOfRecsFromCache
              .filter((e) => e.kind === "workload")
              .map((e) => (
                <WorkloadRow
                  key={e.data.workload_id}
                  workload={e.data as WorkloadRecommendation}
                  customerId={customerId}
                  clusterId={clusterId}
                />
              ))}
            {outOfRecsFromCache
              .filter((e) => e.kind === "pending")
              .map((e) => (
                <PendingRow
                  key={e.data.workload_id}
                  workload={e.data as PendingWorkload}
                  muted
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
