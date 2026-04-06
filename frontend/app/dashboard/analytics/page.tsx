"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Calendar } from "lucide-react"
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const facilityPerformance = [
  { name: "Mumbai", efficiency: 94, throughput: 4200 },
  { name: "Delhi", efficiency: 91, throughput: 3800 },
  { name: "Chennai", efficiency: 88, throughput: 3200 },
  { name: "Kolkata", efficiency: 85, throughput: 2900 },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics & Insights</h1>
          <p className="text-muted-foreground">Facility performance metrics and operational data</p>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="30d">
            <SelectTrigger className="w-36">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Facility Performance */}
      <Card className="clean-card">
        <CardHeader>
          <CardTitle className="text-foreground">Facility Performance</CardTitle>
          <CardDescription>Efficiency and throughput by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facilityPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#000000" }}
                />
                <Bar dataKey="throughput" fill="#FFD600" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4">
            {facilityPerformance.map((facility) => (
              <div key={facility.name} className="text-center">
                <p className="text-lg font-bold text-foreground">{facility.efficiency}%</p>
                <p className="text-xs text-muted-foreground">{facility.name} Efficiency</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
