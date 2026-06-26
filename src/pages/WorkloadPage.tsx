import { useState, useMemo, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Info, Cog } from "lucide-react";
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
import { useWorkloadDetail } from "@/hooks/useWorkloadDetail";
import { useApplyRecommendation } from "@/hooks/useApplyRecommendation";
import { formatBytes, fmtCpu, fmtRam, formatSavingsPercent, fmtHours } from "@/lib/format";
import { useFormatCurrency } from "@/context/CurrencyContext";
import { getErrorCode } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TimeWindow } from "@/types/dashboard";
import type { MetricPoint } from "@/types/cluster";

// ─── constants ────────────────────────────────────────────────────────────────

const TIME_WINDOWS: { label: string; value: TimeWindow; diagnostic?: boolean }[] = [
  { label: "1d", value: "1d", diagnostic: true },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

type GranularityView = "hour" | "day";

const GRANULARITY_OPTIONS: { label: string; value: GranularityView }[] = [
  { label: "Hour", value: "hour" },
  { label: "Day", value: "day" },
];

const STATUS_STYLE: Record<string, string> = {
  WASTEFUL:          "text-rose-500 bg-rose-50",
  UNDER_PROVISIONED: "text-amber-600 bg-amber-50",
  OPTIMAL:           "text-emerald-600 bg-emerald-50",
  MIXED:             "text-orange-500 bg-orange-50",
  UNBOUNDED:         "text-violet-600 bg-violet-50",
  INSUFFICIENT_DATA: "text-neutral-400 bg-neutral-100",
  SPEC_CHANGED:      "text-neutral-400 bg-neutral-100",
};

const STATUS_LABEL: Record<string, string> = {
  WASTEFUL:          "Wasteful",
  UNDER_PROVISIONED: "Under-prov.",
  OPTIMAL:           "Optimal",
  MIXED:             "Mixed",
  UNBOUNDED:         "Unbounded",
  INSUFFICIENT_DATA: "Insuff. data",
  SPEC_CHANGED:      "Spec changed",
};

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

function fmtTime(v: number): string {
  return new Date(v).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDate(v: number): string {
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtCores(cores: number): string {
  if (cores < 0.1) return `${Math.round(cores * 1000)}m`;
  return `${parseFloat(cores.toFixed(3))}`;
}

function fmtDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays >= 1) {
    const h = totalHours % 24;
    return h > 0 ? `${totalDays}d ${h}h` : `${totalDays}d`;
  }
  if (totalHours >= 1) {
    const m = totalMinutes % 60;
    return m > 0 ? `${totalHours}h ${m}m` : `${totalHours}h`;
  }
  if (totalMinutes >= 1) {
    const s = totalSeconds % 60;
    return s > 0 ? `${totalMinutes}m ${s}s` : `${totalMinutes}m`;
  }
  return `${totalSeconds}s`;
}

// ─── WorkloadMetricChart ──────────────────────────────────────────────────────

type WChartPoint = MetricPoint & { ts_ms: number };

function WorkloadMetricChart({
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
}: {
  data: WChartPoint[];
  dataKey: "cpu_cores" | "ram_bytes";
  label: string;
  valueFormatter: (v: number) => string;
  domain: [number | string, number | string];
  tickFormatter: (v: number) => string;
  tickCount: number;
  ticks?: number[];
  accent?: boolean;
  futureFrom?: number;
}) {
  const lineColor = accent ? "#10b981" : "#a3a3a3";
  const dotColor = accent ? "#059669" : "#737373";
  const maxKey = (dataKey === "cpu_cores" ? "max_cpu_cores" : "max_ram_bytes") as
    "max_cpu_cores" | "max_ram_bytes";

  function isSpike(pt: WChartPoint): boolean {
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
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`wgrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
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
              const pt = entry.payload as WChartPoint;
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
                  {val != null && <p style={{ color: "#171717" }}>{valueFormatter(val)}</p>}
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
            fill={`url(#wgrad-${dataKey})`}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={1.5}
            dot={(props: { cx?: number; cy?: number; index: number; payload: WChartPoint }) => {
              if (!isSpike(props.payload) || props.cx == null || props.cy == null)
                return <g key={`wdot-${props.index}`} />;
              return (
                <circle
                  key={`wdot-${props.index}`}
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

// ─── WorkloadPage ─────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const { id, cid, wid } = useParams<{ id: string; cid: string; wid: string }>();
  const customerId = Number(id);
  const clusterId = Number(cid);
  const workloadId = Number(wid);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const s = localStorage.getItem("time_window");
    return (["1d", "7d", "30d"] as TimeWindow[]).includes(s as TimeWindow)
      ? (s as TimeWindow)
      : "7d";
  });
  const [granularity, setGranularity] = useState<GranularityView>("hour");
  const [hourDay, setHourDay] = useState(() => todayStr());
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const apply = useApplyRecommendation();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function navigateDay(dir: -1 | 1) {
    const d = new Date(hourDay + "T00:00:00");
    d.setDate(d.getDate() + dir);
    setHourDay(localDateStr(d));
  }

  const dateRange = useMemo(() => {
    const windowDays: Partial<Record<TimeWindow, number>> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = windowDays[timeWindow] ?? 7;

    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      const isToday = hourDay === todayStr();
      const to = isToday ? new Date() : new Date(d.getTime() + 86_400_000 + 3_600_000);
      // from must reach back at least the full window so the backend sees all samples
      const windowFrom = new Date(to);
      windowFrom.setDate(windowFrom.getDate() - days);
      const from = new Date(Math.min(d.getTime(), windowFrom.getTime()));
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - Math.max(days, 30));
    return { from: from.toISOString(), to: to.toISOString() };
  }, [granularity, hourDay, timeWindow]);

  const fmt = useFormatCurrency();
  const detail = useWorkloadDetail({
    customerId,
    clusterId,
    workloadId,
    timeWindow,
    ...dateRange,
    granularity: granularity === "hour" ? "hour" : "day",
  });

  // Separate fetch for recommendation only — uses a clean wide range so sample_count
  // matches what the cluster list shows (no granularity/from/to scoping artifacts).
  const recRange = useMemo(() => {
    const windowDays: Partial<Record<TimeWindow, number>> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = windowDays[timeWindow] ?? 7;
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [timeWindow]);

  const recDetail = useWorkloadDetail({
    customerId,
    clusterId,
    workloadId,
    timeWindow,
    ...recRange,
    granularity: "day",
  });

  const chartData = useMemo<WChartPoint[]>(() => {
    const points = detail.data?.points ?? [];
    if (granularity === "hour") {
      const dayStart = new Date(hourDay + "T00:00:00").getTime();
      const dayEnd = dayStart + 86_400_000;
      return points
        .filter((p) => { const t = new Date(p.ts).getTime(); return t >= dayStart && t <= dayEnd; })
        .map((p) => ({ ...p, ts_ms: new Date(p.ts).getTime() }));
    }
    return points.map((p) => ({ ...p, ts_ms: new Date(p.ts).getTime() }));
  }, [detail.data, granularity, hourDay]);

  const xDomain = useMemo((): [number | string, number | string] => {
    if (granularity === "hour") {
      const d = new Date(hourDay + "T00:00:00");
      return [d.getTime(), d.getTime() + 86_400_000 + 1];
    }
    return ["dataMin", "dataMax"];
  }, [granularity, hourDay]);

  const futureFromMs = granularity === "hour" && hourDay === todayStr() ? now : undefined;

  const hourTicks = useMemo(() => {
    if (granularity !== "hour") return undefined;
    const start = xDomain[0] as number;
    return Array.from({ length: 7 }, (_, i) => start + i * 4 * 60 * 60 * 1000);
  }, [granularity, xDomain]);

  const hourDayEndMs = granularity === "hour" ? (xDomain[0] as number) + 86_400_000 : 0;
  const tickFormatter =
    granularity === "hour"
      ? (v: number) => (v >= hourDayEndMs ? "24:00" : fmtTime(v))
      : fmtDate;
  const tickCount = granularity === "hour" ? 7 : 6;

  if (
    !id || !cid || !wid ||
    isNaN(customerId) || isNaN(clusterId) || isNaN(workloadId) ||
    customerId <= 0 || clusterId <= 0 || workloadId <= 0
  ) {
    return <Navigate to="/customers" replace />;
  }

  // chart data comes from detail; recommendation/metadata from recDetail (clean params → correct sample counts)
  const workload = recDetail.data ?? detail.data;
  const rec = recDetail.data?.recommendation;

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <Link
        to={`/customers/${customerId}/clusters/${clusterId}`}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-6"
      >
        <ArrowLeft size={12} />
        Cluster
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900">
            {workload?.name ?? "—"}
          </h1>
          {workload && (
            <>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                {workload.kind}
              </span>
              {workload.is_system && (
                <span
                  title="System workload"
                  className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-default"
                >
                  <Cog size={14} />
                </span>
              )}
              <span className="text-xs text-neutral-400">{workload.namespace}</span>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {detail.error && (
        <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">
            {getErrorCode(detail.error) === "WORKLOAD_NOT_FOUND"
              ? "Workload not found."
              : getErrorCode(detail.error) === "ACCESS_DENIED"
              ? "You do not have access to this workload."
              : "Failed to load workload data."}
          </p>
        </div>
      )}

      {/* Resource usage chart */}
      <div className="bg-white border border-neutral-100 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Resource Usage
          </p>
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

        {granularity === "hour" && (
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => navigateDay(-1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:shadow-lg hover:border-[#5AC9E9]/40 transition-colors"
            >
              <ArrowLeft size={12} />
            </button>
            <span className="text-xs text-neutral-700 border-b border-neutral-200 pb-px">
              {hourDay === todayStr() ? "Today" : hourDay}
            </span>
            <button
              onClick={() => navigateDay(1)}
              disabled={hourDay >= todayStr()}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:shadow-lg hover:border-[#5AC9E9]/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {detail.isLoading && (
          <div className="space-y-6">
            <div className="h-36 bg-neutral-50 rounded-lg animate-pulse" />
            <div className="h-36 bg-neutral-50 rounded-lg animate-pulse" />
          </div>
        )}

        {workload && (
          <div
            className={cn(
              "relative z-0 space-y-8 transition-opacity duration-300",
              detail.isFetching ? "opacity-40" : "opacity-100",
            )}
          >
            <WorkloadMetricChart
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
            <WorkloadMetricChart
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
            {chartData.length === 0 && (
              <p className="text-xs text-neutral-400">No metrics data for this period.</p>
            )}
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="bg-white border border-neutral-100 rounded-xl mb-6">
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Recommendation
          </p>
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

        <div className="px-6 py-6">
          {recDetail.isLoading && (
            <div className="space-y-3">
              <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
              <div className="h-4 w-32 bg-neutral-100 rounded animate-pulse" />
            </div>
          )}

          {/* No data at all */}
          {workload && rec == null && (
            <div className="flex items-start gap-3">
              <Info size={14} className="text-neutral-300 mt-0.5 shrink-0" />
              <p className="text-sm text-neutral-500">
                No recommendation yet — not enough data collected for the selected window.
              </p>
            </div>
          )}

          {/* Spec changed / Insufficient data: show dual progress */}
          {(rec?.status === "SPEC_CHANGED" || rec?.status === "INSUFFICIENT_DATA") && rec && (() => {
            const isSpecChanged = rec.status === "SPEC_CHANGED";
            const samplePct = Math.min(100, Math.round((rec.sample_count / rec.samples_required) * 100));
            const timePct   = Math.min(100, Math.round((rec.data_span_hours / rec.span_required_hours) * 100));
            const barColor  = isSpecChanged ? "bg-neutral-300" : "bg-emerald-400";
            return (
              <div className="flex items-start gap-3">
                <Info size={14} className="text-neutral-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-neutral-700">
                    {isSpecChanged
                      ? "Spec recently changed — collecting new samples for the selected window."
                      : "Collecting samples for the selected window."}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-neutral-400">Samples</span>
                        <span className="text-xs text-neutral-400">
                          {rec.sample_count.toLocaleString()} / {rec.samples_required.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${samplePct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-neutral-400">Time</span>
                        <span className="text-xs text-neutral-400">
                          {fmtHours(rec.data_span_hours)} / {fmtHours(rec.span_required_hours)}
                        </span>
                      </div>
                      <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${timePct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Active recommendation */}
          {rec &&
            rec.status !== "SPEC_CHANGED" &&
            rec.status !== "INSUFFICIENT_DATA" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      STATUS_STYLE[rec.status] ?? "text-neutral-400 bg-neutral-100",
                    )}
                  >
                    {STATUS_LABEL[rec.status] ?? rec.status}
                  </span>
                  {rec.stability === "VARIABLE" && (
                    <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                      variable usage
                    </span>
                  )}
                  <span className="text-xs text-neutral-400">
                    {rec.sample_count.toLocaleString()} samples
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">CPU</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Current</span>
                        <span className="text-xs text-neutral-600 font-mono">
                          {fmtCpu(rec.cpu_request_current) || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Recommended</span>
                        <span className="text-xs text-emerald-600 font-mono">
                          {fmtCpu(rec.cpu_recommended)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">P95</span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {rec.p95_cpu_cores.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">P99</span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {rec.p99_cpu_cores.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">RAM</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Current</span>
                        <span className="text-xs text-neutral-600 font-mono">
                          {fmtRam(rec.ram_request_current) || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Recommended</span>
                        <span className="text-xs text-emerald-600 font-mono">
                          {fmtRam(rec.ram_recommended)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">P95</span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {formatBytes(rec.p95_ram_bytes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">P99</span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {formatBytes(rec.p99_ram_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Cost</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Current</span>
                        <span className="text-xs text-neutral-600">
                          {fmt(rec.monthly_cost_current)}/mo
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-400">Recommended</span>
                        <span className="text-xs text-neutral-600">
                          {fmt(rec.monthly_cost_recommended)}/mo
                        </span>
                      </div>
                      {rec.status !== "UNBOUNDED" && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-400">Savings</span>
                            <span className="text-xs text-fluid-green font-medium">
                              {fmt(rec.monthly_savings)}/mo
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-400">Reduction</span>
                            <span className="text-xs text-neutral-500">
                              {formatSavingsPercent(rec.monthly_cost_current, rec.monthly_savings)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Apply */}
                {!confirming ? (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setConfirming(true)}
                      className="px-4 py-1.5 rounded-lg bg-[#2563AF] text-white text-xs font-medium hover:bg-[#1d4ed8] transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 border border-neutral-100 rounded-lg p-4 bg-neutral-50">
                    <div className="flex items-start gap-6 mb-4 text-xs">
                      <div>
                        <p className="text-neutral-400 mb-1">CPU</p>
                        <p className="font-mono text-neutral-700">
                          {fmtCpu(rec.cpu_request_current) || "—"}
                          <span className="mx-1.5 text-neutral-300">→</span>
                          <span className="text-emerald-600">{fmtCpu(rec.cpu_recommended)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-400 mb-1">RAM</p>
                        <p className="font-mono text-neutral-700">
                          {fmtRam(rec.ram_request_current) || "—"}
                          <span className="mx-1.5 text-neutral-300">→</span>
                          <span className="text-emerald-600">{fmtRam(rec.ram_recommended)}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mb-4">
                      Sample collection will restart for the selected window after applying. The recommendation will be unavailable until enough new samples are collected.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setConfirming(false)}
                        disabled={apply.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs text-neutral-500 hover:text-neutral-700 transition-colors disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => apply.mutate(
                          { customerId, clusterId, workloadId, window: timeWindow },
                          { onSuccess: () => setConfirming(false) },
                        )}
                        disabled={apply.isPending}
                        className="px-4 py-1.5 rounded-lg bg-[#2563AF] text-white text-xs font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
                      >
                        {apply.isPending ? "Applying…" : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Spec history */}
      {workload?.spec_history && workload.spec_history.length > 0 && (
        <div className="bg-white border border-neutral-100 rounded-xl overflow-hidden">
          <div className="px-6 py-3 border-b border-neutral-100">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
              Spec History
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left text-neutral-400 font-medium px-6 py-2.5">Time</th>
                <th className="text-left text-neutral-400 font-medium px-3 py-2.5">Source</th>
                <th className="text-right text-neutral-400 font-medium px-3 py-2.5">CPU req</th>
                <th className="text-right text-neutral-400 font-medium px-3 py-2.5">CPU lim</th>
                <th className="text-right text-neutral-400 font-medium px-3 py-2.5">RAM req</th>
                <th className="text-right text-neutral-400 font-medium px-3 py-2.5">RAM lim</th>
                <th className="text-right text-neutral-400 font-medium px-6 py-2.5">Realized savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {workload.spec_history.map((entry, i) => (
                <tr
                  key={i}
                  className={cn(
                    "transition-colors",
                    i === 0
                      ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                      : "hover:bg-neutral-50",
                  )}
                >
                  <td
                    className={cn(
                      "py-3 text-neutral-400 whitespace-nowrap",
                      i === 0
                        ? "pl-[22px] pr-6 border-l-2 border-l-emerald-400"
                        : "px-6",
                    )}
                  >
                    <p>{new Date(entry.recorded_at).toLocaleString()}</p>
                    {i === 0 ? (
                      <p className="text-emerald-500 mt-0.5 font-medium">
                        until Now
                        <span className="ml-1.5 text-emerald-400 font-normal">
                          ({fmtDuration(now - new Date(entry.recorded_at).getTime())})
                        </span>
                      </p>
                    ) : entry.period_end ? (
                      <p className="text-neutral-300 mt-0.5">
                        until {new Date(entry.period_end).toLocaleString()}
                        <span className="ml-1.5">
                          ({fmtDuration(new Date(entry.period_end).getTime() - new Date(entry.recorded_at).getTime())})
                        </span>
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded",
                      entry.source === "applied"  && "text-emerald-600 bg-emerald-50",
                      entry.source === "detected" && "text-blue-500 bg-blue-50",
                      entry.source === "initial"  && "text-orange-500 bg-orange-50",
                    )}>
                      {entry.source}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                    {entry.source === "applied" && entry.prev_cpu_request_cores > 0 ? (
                      <>
                        <span className="text-neutral-300 line-through">{fmtCores(entry.prev_cpu_request_cores)}</span>
                        <span className="mx-1 text-neutral-200">→</span>
                        <span className="text-neutral-700">{fmtCores(entry.cpu_request_cores)}</span>
                      </>
                    ) : (
                      <span className="text-neutral-700">{fmtCores(entry.cpu_request_cores)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-400">
                    {entry.cpu_limit_cores != null ? fmtCores(entry.cpu_limit_cores) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                    {entry.source === "applied" && entry.prev_ram_request_bytes > 0 ? (
                      <>
                        <span className="text-neutral-300 line-through">{formatBytes(entry.prev_ram_request_bytes)}</span>
                        <span className="mx-1 text-neutral-200">→</span>
                        <span className="text-neutral-700">{formatBytes(entry.ram_request_bytes)}</span>
                      </>
                    ) : (
                      <span className="text-neutral-700">{formatBytes(entry.ram_request_bytes)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-400">
                    {entry.ram_limit_bytes != null ? formatBytes(entry.ram_limit_bytes) : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-medium whitespace-nowrap">
                    {entry.realized_savings != null
                      ? <span className="text-fluid-green">{fmt(entry.realized_savings)}</span>
                      : <span className="text-neutral-300">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
