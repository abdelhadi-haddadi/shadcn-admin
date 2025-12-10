// src/components/ui/use-toast.tsx
import { toast as sonnerToast } from 'sonner'

export function useToast() {
  return { toast: sonnerToast }
}

export default useToast
