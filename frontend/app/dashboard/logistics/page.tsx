"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Truck, MapPin, Clock, Package, ArrowRight, Plus, Route } from "lucide-react"

const shipments = [
  {
    id: "SHP-2024-001",
    origin: "Mumbai Hub",
    destination: "Delhi Center",
    material: "PET Bottles",
    weight: "850 KG",
    status: "In Transit",
    progress: 65,
    eta: "2h 15m",
    driver: "Rajesh Kumar",
    vehicle: "TN-01-AB-1234",
  },
  {
    id: "SHP-2024-002",
    origin: "Chennai Hub",
    destination: "Mumbai Hub",
    material: "Aluminum Cans",
    weight: "420 KG",
    status: "Loading",
    progress: 25,
    eta: "5h 30m",
    driver: "Anand Singh",
    vehicle: "MH-12-CD-5678",
  },
  {
    id: "SHP-2024-003",
    origin: "Kolkata Center",
    destination: "Delhi Center",
    material: "Steel Scrap",
    weight: "1,200 KG",
    status: "Scheduled",
    progress: 0,
    eta: "8h 00m",
    driver: "Pradeep Sharma",
    vehicle: "WB-06-EF-9012",
  },
  {
    id: "SHP-2024-004",
    origin: "Delhi Center",
    destination: "Chennai Hub",
    material: "Mixed Plastics",
    weight: "680 KG",
    status: "Delivered",
    progress: 100,
    eta: "Completed",
    driver: "Vikram Patel",
    vehicle: "DL-08-GH-3456",
  },
]

const corridorStats = [
  { route: "Mumbai - Delhi", trips: 24, volume: "12,450 KG", efficiency: 94 },
  { route: "Chennai - Mumbai", trips: 18, volume: "8,920 KG", efficiency: 91 },
  { route: "Kolkata - Delhi", trips: 15, volume: "7,680 KG", efficiency: 88 },
  { route: "Delhi - Chennai", trips: 12, volume: "5,340 KG", efficiency: 92 },
]

export default function LogisticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Logistics Management</h1>
          <p className="text-muted-foreground">Track shipments and manage recycling corridors</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Shipment
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Shipments</CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">8</div>
            <p className="text-xs text-muted-foreground">3 in transit, 5 loading</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Volume</CardTitle>
            <Package className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">4,850 KG</div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">4.2 hrs</div>
            <p className="text-xs text-muted-foreground">-8% improvement</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Corridors</CardTitle>
            <Route className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">12</div>
            <p className="text-xs text-muted-foreground">All operational</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Shipments */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">Active Shipments</CardTitle>
            <CardDescription>Real-time tracking of all shipments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className="rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{shipment.id}</span>
                      <Badge
                        className={
                          shipment.status === "In Transit" ? "bg-chart-2/20 text-chart-2" :
                          shipment.status === "Loading" ? "bg-chart-4/20 text-chart-4" :
                          shipment.status === "Delivered" ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {shipment.status}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground">{shipment.material}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{shipment.weight}</p>
                    <p className="text-xs text-muted-foreground">ETA: {shipment.eta}</p>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{shipment.origin}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">{shipment.destination}</span>
                </div>
                
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground">{shipment.progress}%</span>
                  </div>
                  <Progress value={shipment.progress} className="h-1.5" />
                </div>
                
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Driver: {shipment.driver}</span>
                  <span>{shipment.vehicle}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Corridor Performance */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Corridor Performance</CardTitle>
            <CardDescription>Monthly statistics by route</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {corridorStats.map((corridor) => (
              <div key={corridor.route} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{corridor.route}</span>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {corridor.efficiency}%
                  </Badge>
                </div>
                <Progress value={corridor.efficiency} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{corridor.trips} trips</span>
                  <span>{corridor.volume}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
