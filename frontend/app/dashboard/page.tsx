"use client"

import { MetricCards } from "@/components/dashboard/metric-cards"
import { SankeyDiagram } from "@/components/dashboard/sankey-diagram"
import { TransactionLedger } from "@/components/dashboard/transaction-ledger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Leaf, Droplets, Zap, Factory, Info } from "lucide-react"
import { useState, useEffect } from "react"
import { api, type SustainabilityMetrics } from "@/lib/api"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const recentActivity = [
  { id: 1, action: "Batch verified", location: "Mumbai Hub", time: "2 min ago", status: "success" },
  { id: 2, action: "Shipment departed", location: "Delhi Center", time: "15 min ago", status: "info" },
  { id: 3, action: "Quality alert", location: "Chennai Hub", time: "32 min ago", status: "warning" },
  { id: 4, action: "Processing complete", location: "Kolkata Center", time: "1 hr ago", status: "success" },
]

const processingData = [
  { month: "Jan", inward: 2400, processed: 2200, output: 1980 },
  { month: "Feb", inward: 2800, processed: 2600, output: 2340 },
  { month: "Mar", inward: 3200, processed: 3000, output: 2700 },
  { month: "Apr", inward: 2900, processed: 2750, output: 2475 },
  { month: "May", inward: 3500, processed: 3300, output: 2970 },
  { month: "Jun", inward: 3800, processed: 3600, output: 3240 },
]

const materialBreakdown = [
  { name: "PET Plastics", value: 35, color: "#000000" },
  { name: "HDPE", value: 25, color: "#FFD600" },
  { name: "Aluminum", value: 15, color: "#374151" },
  { name: "Glass", value: 12, color: "#9CA3AF" },
  { name: "Paper", value: 13, color: "#E5E7EB" },
]

const sustainabilityMetrics = [
  { label: "Carbon Offset", value: "12.4 tons", change: "+18%", trend: "up", icon: Leaf, tooltip: "kg CO2 saved", formula: "kg CO2 = Recycled Material (kg) × Material Factor (kg CO2/kg)" },
  { label: "Water Saved", value: "45,000 L", change: "+12%", trend: "up", icon: Droplets, tooltip: "liters saved", formula: "Liters = Recycled Material (kg) × Water Factor (L/kg)" },
  { label: "Energy Recovered", value: "890 kWh", change: "+8%", trend: "up", icon: Zap, tooltip: "From processing activities", formula: "kWh = Material (kg) × Energy Factor (kWh/kg) × Recovery Rate" },
  { label: "Landfill Diversion", value: "98.2%", change: "+2.1%", trend: "up", icon: Factory, tooltip: "kg diverted", formula: "% = (Material Diverted / Total Input) × 100" },
]

export default function DashboardPage() {
  const [hoveredMaterial, setHoveredMaterial] = useState<string | null>(null)
  const [sustainabilityData, setSustainabilityData] = useState<SustainabilityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [anomaliesOnly, setAnomaliesOnly] = useState(false)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.getSustainability(1)
        setSustainabilityData(data)
      } catch (error) {
        console.error("Failed to fetch sustainability metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  useEffect(() => {
    if (anomaliesOnly) {
      document.getElementById("transaction-ledger")?.scrollIntoView({ behavior: "smooth" })
    }
  }, [anomaliesOnly])

  // Format metrics for display
  const displayMetrics = sustainabilityData ? [
    {
      label: "Carbon Offset",
      value: `${sustainabilityData.metrics.carbon_offset_metric_tons.toFixed(1)} tons`,
      change: "+18%",
      trend: "up" as const,
      icon: Leaf,
      tooltip: `${sustainabilityData.metrics.carbon_offset_kg_co2.toLocaleString()} kg CO2 saved`,
      formula: sustainabilityData.formulas.carbon_offset
    },
    {
      label: "Water Saved",
      value: `${sustainabilityData.metrics.water_saved_kiloliters.toFixed(1)} kL`,
      change: "+12%",
      trend: "up" as const,
      icon: Droplets,
      tooltip: `${sustainabilityData.metrics.water_saved_liters.toLocaleString()} liters saved`,
      formula: sustainabilityData.formulas.water_saved
    },
    {
      label: "Energy Recovered",
      value: `${sustainabilityData.metrics.energy_recovered_kwh.toLocaleString()} kWh`,
      change: "+8%",
      trend: "up" as const,
      icon: Zap,
      tooltip: "From processing activities",
      formula: sustainabilityData.formulas.energy_recovered
    },
    {
      label: "Landfill Diversion",
      value: `${sustainabilityData.metrics.landfill_diversion_percent.toFixed(1)}%`,
      change: "+2.1%",
      trend: "up" as const,
      icon: Factory,
      tooltip: `${sustainabilityData.metrics.material_diverted_kg.toLocaleString()} kg diverted`,
      formula: sustainabilityData.formulas.landfill_diversion
    },
  ] : sustainabilityMetrics

  return (
    <div className="space-y-3 font-sans p-3 bg-[#FCFCFC] min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between py-0.5">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tighter text-black leading-none">Traceability Command</h1>
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-[0.2em] mt-1">Circular Ops // Intelligence Center</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-[#FFD600]/30 bg-[#FFD600]/5 px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-black">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD600] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FFD600]" />
          </span>
          System Online
        </Badge>
      </div>

      {/* Metric Cards Row */}
      <MetricCards onAnomalyClick={() => setAnomaliesOnly(true)} />

      {/* Main Grid */}
      <div className="grid gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2 flex flex-col">
          {/* Sankey Diagram */}
          <SankeyDiagram />

          {/* Processing Trends */}
          <Card className="clean-card flex-1 min-h-[400px]">
            <CardHeader>
              <CardTitle className="text-foreground">Processing Trends</CardTitle>
              <CardDescription>Material flow through the recycling pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#000000" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="inward"
                      stroke="#000000"
                      fill="#F3F4F6"
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="processed"
                      stroke="#FFD600"
                      fill="#FFD600"
                      fillOpacity={0.2}
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#000000]" />
                  <span className="text-sm text-black">Inward</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#FFD600]" />
                  <span className="text-sm text-black">Processed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Ledger moved here */}
          <div id="transaction-ledger">
            <TransactionLedger 
              anomaliesOnly={anomaliesOnly} 
              onReset={() => setAnomaliesOnly(false)} 
            />
          </div>
        </div>

        <div className="space-y-2 flex flex-col h-full">
          {/* Material Breakdown */}
          <Card className="clean-card min-h-[440px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base">Material Breakdown</CardTitle>
              <CardDescription className="text-xs">Distribution by material type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={materialBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        onMouseEnter={(entry) => setHoveredMaterial(entry.name)}
                        onMouseLeave={() => setHoveredMaterial(null)}
                      >
                        {materialBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#000000",
                          border: "1px solid #374151",
                          borderRadius: "12px",
                          padding: "12px",
                        }}
                        formatter={(value: any, name: any) => {
                          const material = materialBreakdown.find(m => m.name === name);
                          return [
                            <div key="tooltip" className="text-xs">
                              <div className="text-[#FFD600] font-black uppercase text-[10px] mb-1">Material ID: {name}</div>
                              <div className="text-white text-base font-bold mb-2">{value}% <span className="text-gray-400 text-xs font-normal">of total flow</span></div>
                              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#FFD600]" style={{ width: `${value}%` }} />
                              </div>
                            </div>,
                            ""
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend - Vertical */}
                <div className="grid grid-cols-1 gap-2">
                  {materialBreakdown.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-100 hover:bg-gray-50"
                      onMouseEnter={() => setHoveredMaterial(item.name)}
                      onMouseLeave={() => setHoveredMaterial(null)}
                      style={{
                        backgroundColor: hoveredMaterial === item.name ? `${item.color}10` : "transparent",
                      }}
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-black">{item.name}</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Combined Sustainability Metrics */}
          <Card className="clean-card flex-1">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-black text-sm font-bold uppercase tracking-tight">Sustainability Impact</CardTitle>
              <CardDescription className="text-[10px] -mt-1">
                LCA-based environmental metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                displayMetrics.map((metric, index) => (
                  <div key={metric.label} className="space-y-2 group">
                    <div className="flex items-center justify-between cursor-help" title={metric.tooltip}>
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-[#FFD600]/10 p-2">
                          <metric.icon className="h-4 w-4 text-black" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-black">{metric.label}</p>
                          <p className="text-[10px] text-gray-400">Calculated Yield</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-black">{metric.value}</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-black"
                        style={{
                          width: index === 0 ? "92%" : index === 1 ? "75%" : index === 2 ? "68%" : "98%"
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
