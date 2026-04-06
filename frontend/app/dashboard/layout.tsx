"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { usePathname } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main key={pathname} className="ml-64 min-h-screen p-6 print:ml-0 print:p-0">
        {children}
      </main>
    </div>
  )
}
