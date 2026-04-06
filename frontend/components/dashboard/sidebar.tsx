"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  Truck,
  BarChart3,
  Settings,
  Recycle,
  MessageSquare,
  LogOut,
  ChevronRight,
  Fingerprint,
  FileText,
  TrendingUp,
  BrainCircuit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { ChatPanel } from "./chat-panel"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/fingerprint", label: "AI Fingerprint", icon: Fingerprint },
  { href: "/dashboard/profit-intelligence", label: "Profit Intel", icon: TrendingUp },
  { href: "/dashboard/report", label: "AI Report", icon: BrainCircuit },
  { href: "/dashboard/compliance", label: "Report Filing", icon: FileText },
  { href: "/dashboard/logistics", label: "Logistics", icon: Truck },
]

export function Sidebar() {
  const pathname = usePathname()
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-white">
        {/* Accent top strip */}
        <div className="h-1 w-full bg-[#FFD600]" />
        {/* Logo */}
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6 hover:bg-[#F9FAFB] transition-colors">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFD600] shadow-sm">
            <Recycle className="h-5 w-5 text-black" />
          </div>
          <div>
            <span className="font-bold text-foreground tracking-tight">RecycleIT</span>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Where Recycling Meets Intelligence.</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
            Main Menu
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#F3F4F6] text-black"
                    : "text-[#374151] hover:bg-[#F3F4F6] hover:text-black"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                    isActive ? "bg-[#FFD600] text-black shadow-sm" : "text-[#9CA3AF]"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  {item.label}
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-black" />}
              </Link>
            )
          })}
        </nav>

        {/* AI Assistant Link */}
        <div className="border-t border-sidebar-border p-4">
          <Button
            onClick={() => setChatOpen(true)}
            className="w-full justify-start gap-3 bg-black text-white hover:bg-[#374151] transition-colors"
          >
            <div className="relative">
              <MessageSquare className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD600] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFD600]" />
              </span>
            </div>
            IntelliAgent
          </Button>
        </div>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] border border-[#E5E7EB]">
              <span className="text-sm font-bold text-black">JD</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-black">John Doe</p>
              <p className="text-xs text-[#9CA3AF]">Administrator</p>
            </div>
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#9CA3AF] hover:text-black">
                <LogOut className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Chat Panel */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  )
}
