"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { LifecycleModal } from "@/components/dashboard/lifecycle-modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package, Search, Plus, Filter, ArrowUpDown, TrendingUp, TrendingDown, Minus, Loader2, Upload, FileText, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [inventoryNodes, setInventoryNodes] = useState<any[]>([])
  const [summaryData, setSummaryData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [nlInput, setNlInput] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  
  // Form state
  const [newMaterial, setNewMaterial] = useState({
    material: "",
    quantity: "",
    location: "",
    phase: "PRE-PROCESS"
  })

  const fetchInventory = () => {
    setLoading(true)
    api.getInventory(1)
      .then((res) => {
        setInventoryNodes(res.nodes)
        setSummaryData(res.metrics)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const handleExtract = async () => {
    if (!nlInput.trim()) return
    setIsExtracting(true)
    try {
      const data = await api.extractMaterial(nlInput)
      setNewMaterial({
        material: data.material || newMaterial.material,
        quantity: data.quantity ? String(data.quantity) : newMaterial.quantity,
        location: data.location || newMaterial.location,
        phase: data.phase || newMaterial.phase
      })
      setNlInput(""); // Clear the input after processing to indicate success
    } catch (err) {
      console.error("Extraction failed:", err)
      setUploadError("Failed to extract details from text. Please try describing it differently.")
    } finally {
      setIsExtracting(false)
    }
  }

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setUploadError(null)
    try {
      await api.addMaterial({
        ...newMaterial,
        quantity: Number(newMaterial.quantity)
      })
      setIsAddModalOpen(false)
      setNewMaterial({ material: "", quantity: "", location: "", phase: "PRE-PROCESS" })
      fetchInventory()
    } catch (err) {
      console.error(err)
      setUploadError("Failed to add material. Please check your connection.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsSubmitting(true)
    setUploadError(null)
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r?\n/)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        
        const dataRows = lines.slice(1).filter(line => line.trim().length > 0)
        const total = dataRows.length
        setUploadProgress({ current: 0, total })

        for (let i = 0; i < total; i++) {
          const values = dataRows[i].split(',').map(v => v.trim())
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index]
          })

          // Basic validation & formatting
          const payload = {
            material: row.material || row.name || "Unknown Material",
            quantity: Number(row.quantity || row.qty || 0),
            location: row.location || row.warehouse || "Warehouse A",
            phase: (row.phase || "PRE-PROCESS").toUpperCase()
          }

          await api.addMaterial(payload)
          setUploadProgress({ current: i + 1, total })
        }

        setIsAddModalOpen(false)
        fetchInventory()
        alert(`Successfully uploaded ${total} materials.`)
      } catch (err) {
        console.error(err)
        setUploadError("Error parsing or uploading CSV. Ensure headers match: material, quantity, location, phase.")
      } finally {
        setIsSubmitting(false)
        setUploadProgress(null)
        // Reset file input
        e.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const filteredData = inventoryNodes.filter((item) => {
    const matchesSearch = item.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || item.status.toLowerCase().replace(" ", "-") === statusFilter
    return matchesSearch && matchesStatus
  })

  const summaryCards = summaryData ? [
    { title: "Total Inventory", value: summaryData.total_inventory, description: "Total tracked supply", icon: Package, color: "bg-blue-100/80 text-blue-600" },
    { title: "Available Stock", value: summaryData.available_stock, description: "Ready for processing", icon: TrendingUp, color: "bg-emerald-100/80 text-emerald-600" },
    { title: "In Processing", value: summaryData.in_processing, description: "Active lifecycle stages", icon: ArrowUpDown, color: "bg-amber-100/80 text-amber-600" },
    { title: "Quality Pending", value: summaryData.quality_pending, description: "Awaiting verification", icon: Filter, color: "bg-rose-100/80 text-rose-600" },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage all recyclable materials across locations</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Material
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Main Content Area: Table */}
        <div className="space-y-6 min-w-0">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-foreground">Material Inventory</CardTitle>
                  <CardDescription>Overview of all tracked materials in the system</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search materials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 xl:w-64 pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="in-transit">In Transit</SelectItem>
                      <SelectItem value="quality-check">Quality Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">ID</TableHead>
                      <TableHead className="text-muted-foreground">Material</TableHead>
                      <TableHead className="text-muted-foreground">Quantity</TableHead>
                      <TableHead className="text-muted-foreground">Location</TableHead>
                      <TableHead className="text-muted-foreground">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse">
                          <TableCell colSpan={5} className="h-12 bg-muted/20" />
                        </TableRow>
                      ))
                    ) : filteredData.length > 0 ? (
                      filteredData.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className="border-border cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                          onClick={() => setSelectedNodeId(item.id)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{item.material}</TableCell>
                          <TableCell className="text-foreground">
                            {item.quantity.toLocaleString()} {item.unit}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.location}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.trend === "up" ? (
                                <TrendingUp className="h-4 w-4 text-primary" />
                              ) : item.trend === "down" ? (
                                <TrendingDown className="h-4 w-4 text-destructive" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className={
                                item.trend === "up" ? "text-sm text-primary" :
                                item.trend === "down" ? "text-sm text-destructive" :
                                "text-sm text-muted-foreground"
                              }>
                                {item.change}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No matching materials found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Summary Statistics */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Inventory Summary</h3>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border bg-card animate-pulse">
                <CardHeader className="h-20" />
              </Card>
            ))
          ) : (
            summaryCards.map((card) => (
              <Card key={card.title} className="border-border bg-card transition-all hover:border-black/20 group">
                <div className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${card.color}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF] mb-0.5">{card.title}</p>
                      <p className="text-xl font-bold text-black leading-none">{card.value}</p>
                    </div>
                  </div>
                  <p className="text-[8px] text-[#9CA3AF] uppercase font-bold tracking-tighter mt-2">{card.description}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>



      {/* Lifecycle Modal */}
      <LifecycleModal nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />

      {/* Add Material Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-none shadow-2xl">
          <form onSubmit={handleAddMaterial}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold text-black uppercase tracking-tighter">Add New Material</DialogTitle>
                  <DialogDescription className="text-sm text-[#9CA3AF]">
                    Manually register a batch or bulk upload.
                  </DialogDescription>
                </div>
                <div>
                  <input
                    type="file"
                    id="csv-upload"
                    accept=".csv"
                    className="hidden"
                    onChange={handleBulkUpload}
                    disabled={isSubmitting}
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-[#E5E7EB] text-black hover:bg-[#F3F4F6] text-[10px] font-black uppercase"
                    onClick={() => document.getElementById('csv-upload')?.click()}
                    disabled={isSubmitting}
                  >
                    <Upload className="h-3 w-3" />
                    Bulk CSV
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            {uploadProgress && (
              <div className="mt-4 p-4 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-black">
                  <span>Uploading materials...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-black transition-all duration-300" 
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                {uploadError}
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 border-b border-[#E5E7EB] pb-4 mb-2">
                <Label htmlFor="nlInput" className="text-xs font-black uppercase text-black flex items-center justify-between">
                  <span>Smart Autofill</span>
                  <Badge className="bg-[#FFD600] text-black border-none text-[8px] h-4 px-1 leading-none">AI POWERED</Badge>
                </Label>
                <div className="relative">
                  <Input
                    id="nlInput"
                    placeholder="e.g. Received 500 KG of HDPE at Warehouse A"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    className="h-10 border-[#E5E7EB] bg-[#F9FAFB] focus:ring-[#FFD600] pr-12 text-sm placeholder:text-gray-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleExtract()
                      }
                    }}
                    disabled={isExtracting}
                  />
                  <Button 
                    type="button" 
                    size="icon" 
                    className="absolute right-1 top-1 h-8 w-8 bg-black hover:bg-[#FFD600] group transition-colors"
                    onClick={handleExtract}
                    disabled={isExtracting || !nlInput.trim()}
                  >
                    {isExtracting ? <Loader2 className="h-3 w-3 text-white animate-spin" /> : <Sparkles className="h-3 w-3 text-white group-hover:text-black transition-colors" />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="material" className="text-xs font-black uppercase text-black">Material Name</Label>
                <Input
                  id="material"
                  placeholder="e.g. Recycled PET Flakes"
                  value={newMaterial.material}
                  onChange={(e) => setNewMaterial({ ...newMaterial, material: e.target.value })}
                  className="h-10 border-[#E5E7EB] bg-white focus:ring-[#FFD600]"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity" className="text-xs font-black uppercase text-black">Quantity (KG)</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="0.00"
                  value={newMaterial.quantity}
                  onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                  className="h-10 border-[#E5E7EB] bg-white focus:ring-[#FFD600]"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location" className="text-xs font-black uppercase text-black">Storage Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Warehouse A / Bay 4"
                  value={newMaterial.location}
                  onChange={(e) => setNewMaterial({ ...newMaterial, location: e.target.value })}
                  className="h-10 border-[#E5E7EB] bg-white focus:ring-[#FFD600]"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phase" className="text-xs font-black uppercase text-black">Current Phase</Label>
                <Select 
                  value={newMaterial.phase} 
                  onValueChange={(val) => setNewMaterial({ ...newMaterial, phase: val })}
                >
                  <SelectTrigger className="h-10 border-[#E5E7EB] bg-white">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E7EB]">
                    <SelectItem value="PRE-PROCESS">Pre-Process</SelectItem>
                    <SelectItem value="WASHING">Washing</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="QUALITY">Quality Check</SelectItem>
                    <SelectItem value="LOGISTICS">Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddModalOpen(false)}
                className="h-10 border-[#E5E7EB] text-black hover:bg-[#F3F4F6]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="h-10 bg-black text-white hover:bg-[#374151] min-w-[100px]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
