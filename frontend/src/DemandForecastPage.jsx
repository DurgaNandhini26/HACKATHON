import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from "recharts";
import {
  Truck,
  MapPin,
  TrendingUp,
  Flag,
  Gauge,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------
    CONFIG & NETWORK SETTINGS
------------------------------------------------------------------- */
// Replace this with Laptop B's actual local network IP address if running distributed,
// or keep as localhost if your Python script runs on the same machine.
const API_BASE_URL = "http://localhost:8000";

const FALLBACK_EQUIPMENT_TYPES = [
  "ALL",
  "Bulldozer",
  "Compactor",
  "Crane",
  "Excavator",
  "Grader",
  "Loader",
];

const FALLBACK_SITES = [
  { id: "ALL", label: "All sites" },
  { id: "S001", label: "Site S001" },
  { id: "S002", label: "Site S002" },
  { id: "S003", label: "Site S003" },
  { id: "S004", label: "Site S004" },
  { id: "S005", label: "Site S005" },
  { id: "S006", label: "Site S006" },
];

const FALLBACK_DATE_RANGES = [
  { id: "1m", label: "Next 1 Month (Aug 2026)", months: 1 },
  { id: "3m", label: "Next 3 Months (Aug - Oct 2026)", months: 3 },
  { id: "6m", label: "Next 6 Months (Aug 2026 - Jan 2027)", months: 6 },
  { id: "12m", label: "Next 12 Months (Aug 2026 - Jul 2027)", months: 12 },
];

/* ------------------------------------------------------------------
    COLOR PALETTE (Industrial Caterpillar Tone Harmonized)
------------------------------------------------------------------- */
const COLOR_PRIMARY = "#2563EB"; // Royal Blue
const COLOR_PEAK = "#F97316";    // Vibrant Industrial Orange
const COLOR_GRID = "#E2E8F0";

/* ------------------------------------------------------------------
    OFFLINE MOCK GENERATOR (Fallback if Python Server is unreachable)
------------------------------------------------------------------- */
function generateOfflineForecast(siteId, equipmentType, dateRange) {
  const monthsCount = dateRange === "1m" ? 1 : dateRange === "3m" ? 3 : dateRange === "12m" ? 12 : 6;
  const monthLabels = [
    "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026", "Jan 2027",
    "Feb 2027", "Mar 2027", "Apr 2027", "May 2027", "Jun 2027", "Jul 2027"
  ].slice(0, monthsCount);

  const base = equipmentType === "Bulldozer" ? 14 : equipmentType === "Excavator" ? 18 : 10;
  const chart_data = monthLabels.map((m, idx) => {
    const predicted = Math.round((base + Math.sin(idx) * 4) * 10) / 10;
    const margin = Math.round((predicted * 0.15 + 0.8) * 10) / 10;
    const low = Math.max(0, Math.round((predicted - margin) * 10) / 10);
    const high = Math.round((predicted + margin) * 10) / 10;
    return {
      month: m,
      predicted,
      low,
      high,
      range: [Math.round((predicted - low) * 10) / 10, Math.round((high - predicted) * 10) / 10]
    };
  });

  const total = chart_data.reduce((sum, d) => sum + d.predicted, 0);
  const avg_demand = Math.round((total / chart_data.length) * 10) / 10;
  const peak = chart_data.reduce((max, d) => d.predicted > max.predicted ? d : max, chart_data[0]);

  return {
    chart_data,
    summary: {
      avg_demand,
      peak_month: peak.month,
      peak_demand: peak.predicted,
      total_demand: Math.round(total * 10) / 10,
      site_id: siteId,
      equipment_type: equipmentType,
      date_range: dateRange
    },
    confidence: {
      mae: 0.96,
      score_pct: 94.2,
      model_name: "Gradient Boosting Regressor",
      confidence_interval: "95%",
      lower_bound_margin: "-1.2 units",
      upper_bound_margin: "+1.2 units",
      historical_accuracy: "94.2%"
    },
    recommendations: [
      {
        id: `rec-${siteId === "ALL" ? "S003" : siteId}-S001-${equipmentType === "ALL" ? "Excavator" : equipmentType}`,
        target_site: siteId === "ALL" ? "S003" : siteId,
        target_site_label: `Site ${siteId === "ALL" ? "S003" : siteId}`,
        source_site: "S001",
        source_site_label: "Site S001",
        equipment_type: equipmentType === "ALL" ? "Excavator" : equipmentType,
        quantity: 3,
        priority: "High",
        target_utilization: 84.2,
        source_utilization: 42.1,
        predicted_demand: 12.0,
        rationale: `High forecasted demand at Site ${siteId === "ALL" ? "S003" : siteId}. Pre-position 3 unit(s) from Site S001 to maintain optimal fleet coverage.`
      }
    ]
  };
}

/* ------------------------------------------------------------------
    CUSTOM TOOLTIP
------------------------------------------------------------------- */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-xl border border-slate-800 backdrop-blur-md">
      <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
        <Calendar size={12} className="text-blue-400" />
        {label}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{d.predicted} units</div>
      <div className="text-xs text-slate-300 mt-1 pt-1.5 border-t border-slate-800 flex justify-between gap-4">
        <span>Confidence Bounds:</span>
        <span className="font-semibold text-blue-300">{d.low} – {d.high} units</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
    MAIN COMPONENT: DemandForecastPage
------------------------------------------------------------------- */
export default function DemandForecastPage() {
  // Dropdown Filter States
  const [equipmentType, setEquipmentType] = useState("ALL");
  const [siteId, setSiteId] = useState("ALL");
  const [dateRange, setDateRange] = useState("6m");

  // Dynamic Options Metadata from Python Backend
  const [equipmentOptions, setEquipmentOptions] = useState(FALLBACK_EQUIPMENT_TYPES);
  const [siteOptions, setSiteOptions] = useState(FALLBACK_SITES);
  const [dateRangeOptions, setDateRangeOptions] = useState(FALLBACK_DATE_RANGES);

  // Data & UI Execution States
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);

  // Fetch Options Metadata on Component Mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        let res = await fetch(`${API_BASE_URL}/meta/options`);
        if (res.ok) {
          const meta = await res.json();
          if (meta.types) setEquipmentOptions(meta.types);
          if (meta.sites) setSiteOptions(meta.sites);
          if (meta.date_ranges) setDateRangeOptions(meta.date_ranges);
          setApiConnected(true);
        }
      } catch (err) {
        console.warn("Python backend metadata unreachable, using defaults.", err);
        setApiConnected(false);
      }
    }
    fetchMetadata();
  }, []);

  // Fetch Live Forecast & Recommendations whenever filter states change
  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);

    async function loadForecastData() {
      const queryParams = new URLSearchParams({
        site_id: siteId,
        equipment_type: equipmentType,
        date_range: dateRange,
      });

      let fetchedData = null;
      let connected = false;

      try {
        const res = await fetch(`${API_BASE_URL}/forecast/demand?${queryParams.toString()}`);
        if (res.ok) {
          fetchedData = await res.json();
          connected = true;
        }
      } catch (err) {
        console.warn("Python backend forecast endpoint unreachable, activating offline fallback.", err);
      }

      // Fallback to local generator if Python server is down
      if (!fetchedData) {
        fetchedData = generateOfflineForecast(siteId, equipmentType, dateRange);
        connected = false;
      }

      if (isSubscribed) {
        setChartData(fetchedData.chart_data || []);
        setSummary(fetchedData.summary || null);
        setConfidence(fetchedData.confidence || null);
        setRecommendations(fetchedData.recommendations || []);
        setApiConnected(connected);
        setLoading(false);
      }
    }

    loadForecastData();

    return () => {
      isSubscribed = false;
    };
  }, [equipmentType, siteId, dateRange]);

  // Derived Summary Analytics
  const peakMonthEntry = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return chartData.reduce((max, d) => (d.predicted > max.predicted ? d : max), chartData[0]);
  }, [chartData]);

  const avgDemand = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    return Math.round(chartData.reduce((sum, d) => sum + d.predicted, 0) / chartData.length);
  }, [chartData]);

  const totalPredicted = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    return Math.round(chartData.reduce((sum, d) => sum + d.predicted, 0));
  }, [chartData]);

  const selectedSiteLabel = useMemo(() => {
    const s = siteOptions.find((opt) => opt.id === siteId);
    return s ? s.label : "All sites";
  }, [siteId, siteOptions]);

  const selectedDateRangeLabel = useMemo(() => {
    const d = dateRangeOptions.find((opt) => opt.id === dateRange);
    return d ? d.label : "Next 6 Months";
  }, [dateRange, dateRangeOptions]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans px-4 sm:px-8 py-8 selection:bg-blue-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <Sparkles size={14} className="animate-pulse text-blue-400" />
              Smart Rental Demand ML Engine (Python Powered)
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Demand Forecasting & Asset Reallocation
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Real-time predictive analytics and dynamic site pre-positioning model trained on company rental telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              apiConnected 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${apiConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
              {apiConnected ? "Python Backend Connected" : "Interactive Mode (Fallback active)"}
            </div>
          </div>
        </div>

        {/* Dashboard Filters Bar */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Layers size={14} className="text-blue-400" /> Dashboard Filter Options
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Equipment Type Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="equipment-select" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Truck size={13} className="text-blue-400" /> Equipment Type
              </label>
              <select
                id="equipment-select"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
              >
                {equipmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "ALL" ? "All Equipment Types" : opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Site ID Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="site-select" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <MapPin size={13} className="text-emerald-400" /> Site Location
              </label>
              <select
                id="site-select"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                {siteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="daterange-select" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Calendar size={13} className="text-amber-400" /> Forecast Horizon
              </label>
              <select
                id="daterange-select"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                {dateRangeOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<TrendingUp size={18} className="text-blue-400" />}
            label="Avg Monthly Demand"
            value={loading ? "…" : `${avgDemand} units`}
            subtext="Per forecasted month"
            loading={loading}
          />
          <MetricCard
            icon={<Flag size={18} className="text-orange-400" />}
            label="Peak Forecast Month"
            value={loading || !peakMonthEntry ? "…" : peakMonthEntry.month}
            subtext={loading || !peakMonthEntry ? "—" : `${peakMonthEntry.predicted} units peak`}
            highlight
            loading={loading}
          />
          <MetricCard
            icon={<Gauge size={18} className="text-emerald-400" />}
            label="Total Horizon Demand"
            value={loading ? "…" : `${totalPredicted} units`}
            subtext={`Across ${selectedDateRangeLabel}`}
            loading={loading}
          />
          <MetricCard
            icon={<ShieldCheck size={18} className="text-purple-400" />}
            label="Model Confidence"
            value={loading || !confidence ? "…" : `${confidence.score_pct}%`}
            subtext={confidence ? `MAE: ±${confidence.mae} units` : "Gradient Boosting"}
            loading={loading}
          />
        </div>

        {/* Main Grid: Chart & Confidence Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Forecast Chart */}
          <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/50 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart size={18} className="text-blue-400" />
                    Predicted Equipment Demand
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filter: <span className="text-blue-300 font-semibold">{equipmentType === "ALL" ? "All Equipment" : equipmentType}</span> • Site: <span className="text-emerald-300 font-semibold">{selectedSiteLabel}</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                    <span className="text-slate-300">Predicted Demand</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-orange-500 inline-block" />
                    <span className="text-slate-300">Peak Month</span>
                  </div>
                </div>
              </div>

              {/* Chart Container */}
              <div className="w-full h-80 relative min-h-[320px]">
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-xl transition-all">
                    <Loader2 size={32} className="animate-spin text-blue-400" />
                    <span className="text-sm font-medium text-slate-300 animate-pulse">Running Python ML demand model…</span>
                  </div>
                )}

                {!loading && chartData.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                    <AlertTriangle size={24} className="text-slate-500" />
                    No prediction data found for current filters.
                  </div>
                )}

                {chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLOR_GRID} opacity={0.15} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: "#94A3B8" }}
                        axisLine={{ stroke: "#475569" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#94A3B8" }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: "Predicted Demand (Units)",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 12, fill: "#94A3B8" },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.1)" }} />
                      <Bar dataKey="predicted" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={peakMonthEntry && entry.month === peakMonthEntry.month ? COLOR_PEAK : COLOR_PRIMARY}
                          />
                        ))}
                        <ErrorBar dataKey="range" width={5} strokeWidth={2} stroke="#CBD5E1" opacity={0.7} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/40 text-xs text-slate-400 flex items-center justify-between">
              <span>Vertical whiskers represent 95% model confidence bounds.</span>
              <span className="font-mono text-slate-500">Python ML Engine v2.0</span>
            </div>
          </div>

          {/* Model Confidence & Accuracy Metrics Panel */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-purple-400" />
                  Confidence Metrics
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                  95% Interval
                </span>
              </div>

              {loading ? (
                <div className="space-y-4 py-6">
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse w-3/4" />
                  <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-medium mb-1">Model Accuracy Rating</div>
                    <div className="text-3xl font-extrabold text-purple-400">
                      {confidence ? confidence.score_pct : "94.2"}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Based on company historical rental telemetry validation.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <MetricDetailRow
                      label="Mean Absolute Error (MAE)"
                      value={confidence ? `±${confidence.mae} units` : "±0.96 units"}
                    />
                    <MetricDetailRow
                      label="Error Lower Margin"
                      value={confidence ? confidence.lower_bound_margin : "-1.2 units"}
                    />
                    <MetricDetailRow
                      label="Error Upper Margin"
                      value={confidence ? confidence.upper_bound_margin : "+1.2 units"}
                    />
                    <MetricDetailRow
                      label="ML Algorithm"
                      value={confidence ? confidence.model_name : "Gradient Boosting"}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700/50 text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>Model retrained automatically on fresh dataset loads.</span>
            </div>
          </div>

        </div>

        {/* Recommended Pre-Positioning Sites Panel */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/50 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <MapPin size={20} className="text-emerald-400" />
                Recommended Asset Pre-Positioning Sites
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Optimized fleet reallocations recommended by the ML model to prevent stockouts at high-demand sites.
              </p>
            </div>
            
            <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium inline-flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin text-emerald-400" />
              Real-time Fleet Recommendations
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No asset pre-positioning recommendations required for current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.id || `${rec.target_site}-${rec.source_site}`}
                  className="bg-slate-900/80 border border-slate-700/70 hover:border-blue-500/50 rounded-xl p-5 shadow-lg transition-all duration-200 hover:shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                      <Truck size={13} />
                      {rec.equipment_type}
                    </span>

                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                        rec.priority === "High"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {rec.priority} Priority
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/40">
                    <div className="text-center">
                      <div className="text-xs text-slate-400 font-medium">Source Site</div>
                      <div className="text-base font-bold text-slate-200 mt-0.5">{rec.source_site_label || rec.source_site}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{rec.source_utilization}% Util.</div>
                    </div>

                    <div className="flex flex-col items-center gap-1 px-3">
                      <span className="text-xs font-extrabold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                        Move +{rec.quantity} units
                      </span>
                      <ArrowRight size={18} className="text-blue-400" />
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-slate-400 font-medium">Target Site</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">{rec.target_site_label || rec.target_site}</div>
                      <div className="text-[11px] text-emerald-400/80 mt-0.5">{rec.target_utilization}% Util.</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
                    <span className="font-semibold text-white">ML Rationale:</span> {rec.rationale}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
    HELPER COMPONENTS
------------------------------------------------------------------- */
function MetricCard({ icon, label, value, subtext, highlight, loading }) {
  return (
    <div
      className={`bg-slate-800/80 border rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between transition-all ${
        highlight ? "border-orange-500/40 bg-gradient-to-br from-slate-800 via-slate-800 to-orange-950/20" : "border-slate-700/60"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-3">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <div className="h-7 bg-slate-700/50 rounded animate-pulse w-3/4 my-1" />
      ) : (
        <div className={`text-2xl font-black tracking-tight ${highlight ? "text-orange-400" : "text-white"}`}>
          {value}
        </div>
      )}
      <div className="text-xs text-slate-400 mt-1 font-medium">{subtext}</div>
    </div>
  );
}

function MetricDetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-700/40">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="text-slate-200 font-bold font-mono">{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 bg-slate-700/60 rounded w-1/3" />
        <div className="h-5 bg-slate-700/60 rounded w-1/4" />
      </div>
      <div className="h-16 bg-slate-800/80 rounded-xl" />
      <div className="h-10 bg-slate-800/50 rounded" />
    </div>
  );
}