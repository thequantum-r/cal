"use client"

import { useState, useEffect } from "react"
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react"

const toastTypes = {
  success: { icon: CheckCircle, className: "bg-green-50 border-green-200 text-green-800" },
  error: { icon: XCircle, className: "bg-red-50 border-red-200 text-red-800" },
  warning: { icon: AlertCircle, className: "bg-yellow-50 border-yellow-200 text-yellow-800" },
}

export function Toast({ message, type = "success", duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true)
  const toastConfig = toastTypes[type]
  const Icon = toastConfig.icon

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-lg border shadow-lg transition-all duration-300 ${toastConfig.className}`}>
      <div className="flex items-start space-x-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

