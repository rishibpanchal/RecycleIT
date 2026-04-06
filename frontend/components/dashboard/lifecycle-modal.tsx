"use client"

import { useEffect, useState } from "react"
import { X, AlertTriangle, CheckCircle2, ArrowRight, Package, TrendingDown, TrendingUp, Zap, Activity } from "lucide-react"
import { api, type LifecycleData, type LifecycleHop } from "@/lib/api"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts"

const PHASE_COLORS: Record<string, string> = {
  "COLLECTION": "#000000",
  "PRE-PROCESS": "#374151",
  "WASHING": "#9CA3AF",
  "PROCESSING": "#FFD600",
  "QUALITY": "#10B981", // Keep success green for quality? Or black. Let's use black/grey mostly.
  "LOGISTICS": "#374151",
  "OUTPUT": "#000000",
  "UNKNOWN": "#9CA3AF",
}

const PHASE_BG: Record<string, string> = {
  "COLLECTION": "#F3F4F6",
  "PRE-PROCESS": "#F3F4F6",
  "WASHING": "#F3F4F6",
  "PROCESSING": "#FFD60022",
  "QUALITY": "#10B98122",
  "LOGISTICS": "#F3F4F6",
  "OUTPUT": "#F3F4F6",
  "UNKNOWN": "#F3F4F6",
}

function phaseColor(phase: string) {
  return PHASE_COLORS[phase?.toUpperCase?.()] ?? "#7c6fa0"
}
function phaseBg(phase: string) {
  return PHASE_BG[phase?.toUpperCase?.()] ?? "#7c6fa022"
}

interface LifecycleModalProps {
  transactionId?: string | null
  nodeId?: string | null
  onClose: () => void
}

export function LifecycleModal({ transactionId, nodeId, onClose }: LifecycleModalProps) {
  const [data, setData] = useState<LifecycleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!transactionId && !nodeId) return
    setLoading(true)
    setError(null)
    setData(null)
    
    const promise = transactionId 
      ? api.getLifecycle(transactionId)
      : nodeId
      ? api.getNodeLifecycle(nodeId)
      : null
      
    if (promise) {
      promise
        .then(setData)
        .catch((e) => setError(e.message ?? "Failed to load lifecycle data"))
        .finally(() => setLoading(false))
    }
  }, [transactionId, nodeId])

  if (!transactionId && !nodeId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl bg-white"
        style={{
          border: "1px solid #E5E7EB",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header yellow strip */}
        <div className="h-1.5 w-full rounded-t-3xl bg-[#FFD600]" />

        {/* Close btn */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-black hover:bg-[#E5E7EB] transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="h-12 w-12 rounded-full border-4 border-[#F3F4F6] border-t-black animate-spin" />
              <p className="text-sm font-medium text-[#9CA3AF]">Loading lifecycle data…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertTriangle className="h-12 w-12 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Title */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black shadow-sm">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-black">{transactionId ? "Transaction Lifecycle" : "Material Lifecycle"}</h2>
                    <p className="font-mono text-xs text-[#9CA3AF]">{transactionId || nodeId}</p>
                  </div>
                  {transactionId && data.summary.has_anomaly ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                      <AlertTriangle className="h-3 w-3" /> Anomaly
                    </span>
                  ) : transactionId ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-bold text-black border border-[#E5E7EB]">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  ) : null
                }
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {data.lifecycle_stages.map((stage, i) => (
                    <span
                      key={stage}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: phaseBg(stage), color: phaseColor(stage), border: `1px solid ${phaseColor(stage)}44` }}
                    >
                      {i > 0 && <ArrowRight className="h-3 w-3 opacity-40" />}
                      {stage}
                    </span>
                  ))}
                </div>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
                {[
                  { label: "Total Input", value: `${data.summary.total_input_qty.toLocaleString()} KG`, icon: Package },
                  { label: "Total Output", value: `${data.summary.total_output_qty.toLocaleString()} KG`, icon: TrendingUp },
                  { label: "Total Loss", value: `${data.summary.total_loss_qty.toLocaleString()} KG`, icon: TrendingDown },
                  { label: "Yield", value: `${data.summary.cumulative_yield_pct}%`, icon: Zap },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="clean-card rounded-2xl bg-white p-4 text-black"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <kpi.icon className="h-4 w-4 text-[#9CA3AF]" />
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{kpi.label}</p>
                    </div>
                    <p className="text-xl font-extrabold">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Journey Flow Chart */}
              <JourneyFlowChart hops={data.journey.all_hops} />

              {/* Staged Waterfall Table */}
              <StagedWaterfall hops={data.journey.all_hops} />

              {/* Phase distribution pie */}
              <PhaseDistribution hops={data.journey.all_hops} />

              {/* Transaction details (only for transaction lifecycle) */}
              {data.target_edge && <EdgeDetails edge={data.target_edge} />}
              
              {/* Node details (only for node lifecycle) */}
              {(data as any).target_node && <NodeDetails node={(data as any).target_node} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Node Detail Card ───────────────────────────────────────────── */
function NodeDetails({ node }: { node: any }) {
  const rows = [
    ["Node ID", node.id],
    ["Material Label", node.label],
    ["Lifecycle Stage", node.lifecycle_label],
    ["Phase", node.phase],
    ["Facility", node.warehouse_label || "—"],
    ["Last Known Qty", `${Number(node.last_known_qty).toLocaleString()} KG`],
    ["Is Root Source", node.is_root_source ? "✓ Yes" : "—"],
    ["Is Terminal Sink", node.is_terminal_sink ? "✓ Yes" : "—"],
  ]

  return (
    <div className="clean-card rounded-2xl bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
        <span className="h-4 w-1 rounded-full bg-black" />
        Material Details
      </h3>
      <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-[#F3F4F6] transition-colors border border-transparent hover:border-[#E5E7EB]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] w-28 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-xs font-medium text-black">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Journey Flow Diagram ─────────────────────────────────────── */
function JourneyFlowChart({ hops }: { hops: LifecycleHop[] }) {
  if (!hops.length) return null

  // Build unique nodes list in order
  const nodes: { id: string; label: string; phase: string; qty: number; direction: string }[] = []
  const seen = new Set<string>()

  for (const hop of hops) {
    if (!seen.has(hop.from_node.id)) {
      seen.add(hop.from_node.id)
      nodes.push({ id: hop.from_node.id, label: hop.from_node.label || hop.from_node.lifecycle_label, phase: hop.from_node.phase, qty: hop.from_node.last_known_qty, direction: hop.direction })
    }
    if (!seen.has(hop.to_node.id)) {
      seen.add(hop.to_node.id)
      nodes.push({ id: hop.to_node.id, label: hop.to_node.label || hop.to_node.lifecycle_label, phase: hop.to_node.phase, qty: hop.to_node.last_known_qty, direction: hop.direction })
    }
  }

  return (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
        <span className="h-4 w-1 rounded-full bg-[#FFD600]" />
        Journey Flow
      </h3>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max">
          {nodes.map((node, i) => (
            <div key={node.id} className="flex items-center">
              {i > 0 && (
                <div className="flex flex-col items-center mx-1">
                  <div className="h-px w-8 bg-[#E5E7EB]" />
                  <ArrowRight className="h-3 w-3 text-[#9CA3AF] -mt-1.5" />
                </div>
              )}
              <div
                className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-center transition-all hover:scale-105 cursor-default min-w-[80px]"
                style={{ background: phaseBg(node.phase), border: `1.5px solid ${phaseColor(node.phase)}55` }}
              >
                <p className="text-[10px] font-bold leading-tight" style={{ color: phaseColor(node.phase) }}>{node.label?.length > 12 ? node.label.slice(0, 12) + "…" : node.label}</p>
                <p className="text-[9px] font-medium text-black">{node.qty.toLocaleString()} KG</p>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                  style={{ background: phaseColor(node.phase), color: node.phase === "PROCESSING" ? "#000" : "#fff" }}
                >
                  {node.phase}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Staged Waterfall Table ─────────────────────────────────────── */
function StagedWaterfall({ hops }: { hops: LifecycleHop[] }) {
  if (!hops.length) return null

  return (
    <div className="mb-6 clean-card rounded-2xl bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
        <span className="h-4 w-1 rounded-full bg-black" />
        Lifecycle Waterfall
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-[#E5E7EB]">
              <th className="text-left px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Stage</th>
              <th className="text-right px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Input (KG)</th>
              <th className="text-right px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Loss (KG)</th>
              <th className="text-right px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Loss %</th>
              <th className="text-right px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Remaining (KG)</th>
              <th className="text-center px-2 py-2 font-bold text-[#9CA3AF] uppercase tracking-wider">Phase</th>
            </tr>
          </thead>
          <tbody>
            {hops.map((hop, i) => {
              const lossQty = hop.edge.loss_qty ?? 0
              const inputQty = hop.from_node.last_known_qty
              const outputQty = hop.to_node.last_known_qty
              const lossPercent = inputQty > 0 ? ((lossQty / inputQty) * 100).toFixed(1) : "0"
              const phase = hop.to_node.phase || "UNKNOWN"
              const bgColor = phaseBg(phase)
              const fgColor = phaseColor(phase)
              
              return (
                <tr key={i} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-2 py-2 font-medium text-black">
                    {hop.from_node.label || hop.from_node.lifecycle_label}
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-black">
                    {inputQty.toLocaleString()}
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-red-600 font-bold">
                    {lossQty.toLocaleString()}
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-red-600 font-bold">
                    {lossPercent}%
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-black font-bold">
                    {outputQty.toLocaleString()}
                  </td>
                  <td className="text-center px-2 py-2">
                    <span
                      className="inline-flex px-2 py-1 rounded text-[10px] font-bold"
                      style={{ background: bgColor, color: fgColor }}
                    >
                      {phase}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Phase Distribution Pie ─────────────────────────────────────── */
function PhaseDistribution({ hops }: { hops: LifecycleHop[] }) {
  if (!hops.length) return null

  const phaseCounts: Record<string, number> = {}
  for (const h of hops) {
    const p = h.to_node.phase || "UNKNOWN"
    phaseCounts[p] = (phaseCounts[p] || 0) + h.edge.quantity
  }

  const data = Object.entries(phaseCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="mb-6 clean-card rounded-2xl bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
        <span className="h-4 w-1 rounded-full bg-[#FFD600]" />
        Volume by Lifecycle Phase (KG)
      </h3>
      <div className="flex items-center gap-4">
        <div className="h-40 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={phaseColor(entry.name)} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", fontSize: 11, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                formatter={(val: number) => [`${val.toLocaleString()} KG`]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: phaseColor(d.name) }} />
              <span className="text-xs text-black font-medium">{d.name}</span>
              <span className="text-xs text-[#9CA3AF] ml-auto">{d.value.toLocaleString()} KG</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Edge Detail Table ──────────────────────────────────────────── */
function EdgeDetails({ edge }: { edge: any }) {
  if (!edge) return null
  
  const rows = [
    ["Transaction ID", edge.transaction_id],
    ["Date", edge.transaction_date || "—"],
    ["Source → Destination", `${edge.from} → ${edge.to}`],
    ["Stage", edge.lifecycle_label],
    ["Warehouse", edge.warehouse_label || "—"],
    ["Quantity", `${Number(edge.quantity).toLocaleString()} KG`],
    ["Loss Qty", `${Number(edge.loss_qty ?? 0).toLocaleString()} KG`],
    ["Loss %", `${Number(edge.loss_percent ?? 0).toFixed(2)}%`],
    ["Status", edge.status || "Approved"],
    ["Mode", edge.mode || "—"],
    ["Remarks", edge.remarks || "—"],
    ["Anomaly", edge.is_anomaly ? "⚠ Yes" : "✓ No"],
  ]

  return (
    <div className="clean-card rounded-2xl bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-black">
        <span className="h-4 w-1 rounded-full bg-black" />
        Transaction Details
      </h3>
      <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-[#F3F4F6] transition-colors border border-transparent hover:border-[#E5E7EB]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] w-28 flex-shrink-0 pt-0.5">{label}</span>
            <span className={`text-xs font-medium ${label === "Anomaly" && String(value).startsWith("⚠") ? "text-red-600" : label === "Anomaly" ? "text-black" : "text-black"}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
