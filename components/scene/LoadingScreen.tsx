'use client'

import { useState, useEffect } from 'react'
import { useProgress } from '@react-three/drei'

export function LoadingScreen() {
  const { progress, active } = useProgress()
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (progress === 100 && !active) {
      const timeout = setTimeout(() => setShow(false), 500)
      return () => clearTimeout(timeout)
    }
  }, [progress, active])

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1a1410] transition-opacity duration-500 ${
        progress === 100 ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <h1 className="text-lg font-medium tracking-tight text-[#f5e6c3] mb-6">Charter</h1>
      <div className="w-64 h-1 bg-[#4a3728] rounded-sm overflow-hidden">
        <div
          className="h-full bg-[#d4b896] rounded-sm"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-[#b8956f] mt-3">Loading scene... {Math.round(progress)}%</p>
    </div>
  )
}
