import { createFileRoute } from "@tanstack/react-router";
import POS from "@/features/pos/index";

export const Route = createFileRoute("/pos")({
  component: POS,
});
