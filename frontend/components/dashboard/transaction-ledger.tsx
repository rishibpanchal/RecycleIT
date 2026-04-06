"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, Filter, ExternalLink, Search, Maximize2, X } from "lucide-react"
import { api, type Edge } from "@/lib/api"
import { LifecycleModal } from "./lifecycle-modal"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PAGE_SIZE = 8

const getStageStyles = (label: string) => {
  const l = label.toUpperCase();
  if (l.includes("INWARD") || l.includes("COLLECTION")) return "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100";
  if (l.includes("WASHING")) return "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100";
  if (l.includes("RECYCLING") || l.includes("GRANULATION") || l.includes("PROCESSING")) return "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100";
  if (l.includes("PRODUCTION")) return "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100";
  if (l.includes("DISPATCH") || l.includes("LOGISTICS") || l.includes("TRANSFER")) return "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100";
  if (l.includes("QC") || l.includes("QUALITY")) return "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100";
  return "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100";
}

export function TransactionLedger({
  anomaliesOnly = false,
  onReset
}: {
  anomaliesOnly?: boolean,
  onReset?: () => void
}) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [stageFilter, setStageFilter] = useState("ALL")
  const [isFullModalOpen, setIsFullModalOpen] = useState(false)

  useEffect(() => {
    setPage(0)
  }, [anomaliesOnly, searchQuery, statusFilter, stageFilter])

  useEffect(() => {
    api.getEdges(1)
      .then((res) => setEdges(res.edges))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // List unique values for filters
  const stages = Array.from(new Set(edges.map(e => e.lifecycle_label))).sort()
  const statuses = Array.from(new Set(edges.map(e => e.status || "Approved"))).sort()

  const displayEdges = edges.filter(e => {
    const matchesAnomaly = anomaliesOnly ? e.is_anomaly : true
    const matchesSearch = e.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.to.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || (e.status || "Approved") === statusFilter
    const matchesStage = stageFilter === "ALL" || e.lifecycle_label === stageFilter
    
    return matchesAnomaly && matchesSearch && matchesStatus && matchesStage
  })

  const totalPages = Math.ceil(displayEdges.length / PAGE_SIZE)
  const visible = displayEdges.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <>
      <Card className="clean-card border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pb-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tighter text-black">Transaction Registry</CardTitle>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-0.5">Live Ledger // Forensic Traceability</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9CA3AF]" />
                <Input
                  placeholder="Search TX ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs border-[#E5E7EB] bg-white focus:ring-[#FFD600]"
                />
              </div>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-9 w-32 text-xs border-[#E5E7EB] bg-white">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stages</SelectItem>
                  {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 text-xs border-[#E5E7EB] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              {anomaliesOnly && (
                <Button 
                  onClick={onReset}
                  variant="outline" 
                  size="sm" 
                  className="h-9 rounded-lg border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Anomalies Only
                </Button>
              )}
              
              <Button 
                onClick={() => setIsFullModalOpen(true)}
                variant="outline" 
                size="sm" 
                className="h-9 gap-2 border-[#E5E7EB] text-black hover:bg-[#F3F4F6]"
              >
                <Maximize2 className="h-4 w-4" />
                Expand View
              </Button>
            </div>

          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
            <Table>
              <TableHeader className="bg-white border-y border-[#E5E7EB]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">TX ID</TableHead>
                  <TableHead className="h-8 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Timestamp</TableHead>
                  <TableHead className="h-8 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Stage</TableHead>
                  <TableHead className="h-8 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Manifest</TableHead>
                  <TableHead className="h-8 text-right text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Quantity</TableHead>
                  <TableHead className="h-8 text-right text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Yield</TableHead>
                  <TableHead className="h-8 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Status</TableHead>
                  <TableHead className="h-8 w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 animate-pulse rounded-lg bg-[#F3F4F6]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[#9CA3AF] py-8">
                      No transaction data found
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((e, i) => (
                    <TableRow
                      key={`${e.transaction_id}-${i}`}
                      className="group cursor-pointer border-b border-[#F3F4F6] transition-all hover:bg-[#F9FAFB] h-10"
                      onClick={() => setSelectedTxId(e.transaction_id)}
                    >
                      <TableCell className="text-[11px] font-black text-black font-mono tracking-tighter" title={e.transaction_id}>
                        {e.transaction_id}
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-[#9CA3AF] uppercase">{e.transaction_date || "—"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[9px] font-bold uppercase tracking-tight px-2 py-0 border leading-relaxed", getStageStyles(e.lifecycle_label))}
                        >
                          {e.lifecycle_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight">
                          <span className="text-[#9CA3AF]">{e.from}</span>
                          <span className="text-[#FFD600]">→</span>
                          <span className="text-[#9CA3AF]">{e.to}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[11px] font-black text-black">
                        {e.quantity.toLocaleString()} KG
                      </TableCell>
                      <TableCell className={`text-right text-[11px] font-black ${e.loss_percent > 3 ? "text-red-600" : "text-black"}`}>
                        {(100 - e.loss_percent).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full mx-auto",
                          e.is_anomaly ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-[#10B981]"
                        )} />
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="h-3 w-3 text-[#E5E7EB] group-hover:text-black transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-[#9CA3AF]">
              {loading
                ? "Loading…"
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, displayEdges.length)} of ${displayEdges.length} ${anomaliesOnly ? "anomalous" : ""} transactions`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="border-[#E5E7EB] text-black hover:bg-[#F3F4F6]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="border-[#E5E7EB] text-black hover:bg-[#F3F4F6]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Full List Modal */}
      <Dialog open={isFullModalOpen} onOpenChange={setIsFullModalOpen}>
        <DialogContent className="max-w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl rounded-none">
          <DialogHeader className="p-4 border-b border-[#E5E7EB] bg-[#FCFCFC]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-black uppercase tracking-tighter text-black">Master Registry // Comprehensive Audit</DialogTitle>
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-0.5">{displayEdges.length} Verified Records Found</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsFullModalOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-[#F9FAFB]/30">
            <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-white border-b border-[#E5E7EB]">
                  <TableRow className="hover:bg-transparent h-10">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] pl-4">TX ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Timestamp</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Lifecycle Stage</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Origin</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] text-center">→</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Destination</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] text-right px-4">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] text-right">Yield</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayEdges.map((e, index) => (
                    <TableRow 
                      key={index}
                      className="h-9 group hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-[#F3F4F6]"
                      onClick={() => {
                        setSelectedTxId(e.transaction_id)
                        setIsFullModalOpen(false)
                      }}
                    >
                      <TableCell className="font-mono text-[11px] font-black pl-4 text-black">{e.transaction_id}</TableCell>
                      <TableCell className="text-[10px] font-bold text-[#9CA3AF] uppercase">{e.transaction_date}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[8px] font-bold uppercase tracking-tight px-1.5 py-0 border", getStageStyles(e.lifecycle_label))}
                        >
                          {e.lifecycle_label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-[10px] font-bold uppercase">{e.from}</TableCell>
                      <TableCell className="text-center"><span className="text-[#FFD600] font-bold">→</span></TableCell>
                      <TableCell className="max-w-[150px] truncate text-[10px] font-bold uppercase">{e.to}</TableCell>
                      <TableCell className="text-right font-black text-black px-4 text-[11px]">{e.quantity.toLocaleString()} KG</TableCell>
                      <TableCell className={`text-right font-black text-[11px] ${e.loss_percent > 3 ? "text-red-600" : "text-black"}`}>
                        {(100 - e.loss_percent).toFixed(1)}%
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className={cn(
                          "h-2 w-2 rounded-full mx-auto",
                          e.is_anomaly ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                        )} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lifecycle Detail Modal */}
      <LifecycleModal
        transactionId={selectedTxId}
        onClose={() => setSelectedTxId(null)}
      />
    </>

  )
}
