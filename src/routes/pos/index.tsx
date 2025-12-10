// src/routes/pos/index.tsx
import { createFileRoute } from "@tanstack/react-router"
import MoroccanPOSSystem from "@/components/pos/pos-system"

export const Route = createFileRoute("/pos")({
  component: MoroccanPOSSystem,
})

export default Route
