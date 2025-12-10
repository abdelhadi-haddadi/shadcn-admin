// src/components/ui/progress.tsx
import * as React from 'react'

export function Progress({ value = 0 }: { value?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
      <div style={{ width: `${pct}%` }} className="h-2 bg-primary-600" />
    </div>
  )
}

export default Progress
