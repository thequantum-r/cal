"use client"

import { useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function RouteToastListener() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    const login = params.get("login")
    const signedout = params.get("signedout")

   if (login) {
  if (login === "new") {
    toast({ title: "Login successful!", description: "Your account is ready." })
  } else {
    toast({ title: "Signed in", description: "You are now signed in." })
  }
  params.delete("login")
}

    if (signedout) {
      toast({ title: "Signed out", description: "You have been signed out successfully." })
      params.delete("signedout")
    }

    if (login || signedout) {
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
      router.replace(newUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}


