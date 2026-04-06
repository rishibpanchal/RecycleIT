"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api, type ComplianceData } from "@/lib/api"
import { 
  FileText, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle, 
  Calendar,
  CheckCircle2,
  FileCheck,
  Building2,
  Info,
  Loader2
} from "lucide-react"

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    api.getForm4(1)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const result = await api.downloadForm4(1)
      const blob = new Blob([result.content], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download report", error)
      alert("Failed to generate report. Ensure backend is running.")
    } finally {
      setDownloading(false)
    }
  }

  const fiscalYear = data?.fiscal_year || "2025-2026"

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-black leading-tight">Compliance & Reporting</h1>
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-[0.2em] mt-1">EPR Regulatory Hub // CPCB Portal Integration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-[#E5E7EB] text-black text-[10px] font-black uppercase">
            <Calendar className="h-3.5 w-3.5 text-[#FFD600]" />
            FY {fiscalYear}
          </Button>
          <Button 
            size="sm" 
            onClick={handleDownload}
            disabled={downloading || loading}
            className="gap-2 bg-black text-white hover:bg-[#374151] text-[10px] font-black uppercase shadow-[4px_4px_0_0_#FFD600]"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Generate Form 4
          </Button>
        </div>
      </div>

      {/* Regulatory Context Alert */}
      <div className="rounded-xl border border-[#FFD600]/30 bg-[#FFD600]/5 p-5">
        <div className="flex gap-4 items-center">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFD600] text-black shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black uppercase tracking-tight">CPCB 2024 Rule 11 Compliance</h3>
            <p className="text-[10px] text-black/70 mt-0.5 font-medium leading-relaxed">
              Every facility-level transaction is mapped to the centralized CPCB database. 
              Unique QR identifiers will be auto-generated for every batch dispatched to valid PIBOs.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Dashboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Form 4 Data Grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-[#E5E7EB] shadow-sm bg-white overflow-hidden rounded-2xl">
            <CardHeader className="bg-black text-white py-4 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold uppercase tracking-tight">CPCB Form 4: Annual Return</CardTitle>
                </div>
                <Badge className="bg-[#10B981]/20 text-[#10B981] border-none uppercase text-[8px] font-black tracking-widest">
                  {data?.audit_ready ? "Audit Ready" : "Drafting"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#E5E7EB]">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent mx-auto" />
                    </div>
                ) : (
                  data?.sections.map((row) => (
                    <div key={row.field} className="group p-5 flex items-start justify-between transition-all hover:bg-[#F3F4F6]/50">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                          {row.label}
                        </p>
                        <h4 className="font-bold text-black text-xs leading-none">{row.field}</h4>
                        <p className="text-[9px] text-gray-400 font-medium mt-1">Source: {row.strategy}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-black leading-none">{row.value.toLocaleString()} {row.unit}</p>
                        <div className="flex items-center justify-end gap-1 mt-1.5">
                          <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                          <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-tighter">{row.subtext}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Validation & QR Status */}
        <div className="space-y-3">
          <Card className="border border-[#E5E7EB] shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-black font-black uppercase text-[10px] tracking-widest">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="h-28 w-28 transform -rotate-90">
                    <circle className="text-[#F3F4F6]" strokeWidth="6" stroke="currentColor" fill="transparent" r="50" cx="56" cy="56" />
                    <circle 
                      className="text-[#FFD600]" 
                      strokeWidth="6" 
                      strokeDasharray={314} 
                      strokeDashoffset={314 * (1 - (data?.compliance_score || 0) / 100)} 
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="50" 
                      cx="56" 
                      cy="56" 
                    />
                  </svg>
                  <span className="absolute text-2xl font-black text-black">{data?.compliance_score || 0}%</span>
                </div>
                <p className="mt-3 text-[10px] font-black text-black uppercase tracking-tight">System Reliability</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-black text-white rounded-2xl overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#FFD600]" />
                <CardTitle className="font-black uppercase text-[10px] tracking-widest">PWP Logic</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[8px] font-black text-[#FFD600] uppercase mb-1">PWP Reg. #</p>
                <p className="text-[10px] font-mono opacity-80">{data?.pwp_registration}</p>
              </div>
              <Button size="sm" className="w-full bg-[#FFD600] text-black hover:bg-[#FFD600]/90 font-black uppercase text-[10px] rounded-lg">
                Validate CPCB Hook
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#FFD600]" />
                <CardTitle className="font-black text-black uppercase text-[10px] tracking-widest">Timeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-1 bg-[#10B981] rounded-full" />
                  <div>
                    <p className="text-[10px] font-bold text-black leading-none">Quarterly Returns</p>
                    <p className="text-[8px] text-[#10B981] font-black mt-1 uppercase">Q3 COMPLETED</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-1 bg-[#FFD600] rounded-full animate-pulse" />
                  <div>
                    <p className="text-[10px] font-bold text-black leading-none">Annual Form 4 Filing</p>
                    <p className="text-[8px] text-gray-400 font-black mt-1 uppercase">DUE IN 24 DAYS</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
