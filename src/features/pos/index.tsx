// components/pos/pos-system.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  ShoppingCart, 
  Receipt, 
  Calculator,
  CreditCard,
  Cash,
  Printer,
  QrCode,
  Tag,
  Percent,
  Users,
  Package,
  BarChart,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Download,
  Upload,
  Settings,
  Moon,
  Sun,
  Bell,
  User,
  Shield,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { Progress } from '@/components/ui/progress'

// Moroccan specific types and utilities
type TVARate = 0.1 | 0.2 | 0.14 // Moroccan VAT rates: 10%, 20%, 14%
type PaymentMethod = 'cash' | 'credit_card' | 'cheque' | 'mobile_money' | 'bank_transfer'
type ReceiptType = 'client' | 'simplified' | 'detailed' | 'export'
type Currency = 'MAD' | 'EUR' | 'USD'

interface Product {
  id: string
  code: string
  name: string
  name_arabic: string
  barcode: string
  category: string
  price: number
  tva_rate: TVARate
  unit: string
  stock: number
  min_stock: number
  supplier: string
  cost_price: number
  margin: number
  image?: string
}

interface CartItem {
  product: Product
  quantity: number
  discount: number
  subtotal: number
  tva_amount: number
}

interface Customer {
  id: string
  code: string
  name: string
  phone: string
  email?: string
  address?: string
  city: string
  ice?: string // Identifiant Commun de l'Entreprise
  rc?: string // Registre de Commerce
  tp?: string // Taxe Professionnelle
  cnss?: string // CNSS number
  credit_limit: number
  credit_used: number
  is_vip: boolean
}

interface Sale {
  id: string
  receipt_number: string
  customer?: Customer
  items: CartItem[]
  subtotal: number
  discount_total: number
  tva_total: number
  total: number
  paid: number
  change: number
  payment_method: PaymentMethod
  payment_status: 'paid' | 'partial' | 'pending' | 'credit'
  created_at: Date
  cashier: string
  shift_id: string
  notes?: string
}

interface Shift {
  id: string
  cashier: string
  start_time: Date
  end_time?: Date
  opening_balance: number
  closing_balance?: number
  cash_sales: number
  card_sales: number
  cheque_sales: number
  total_sales: number
  expected_cash: number
  difference?: number
  status: 'open' | 'closed'
}

// Moroccan receipt format compliant with DGTR (Direction Générale des Taxes)
interface MoroccanReceipt {
  en_tete: {
    raison_sociale: string
    adresse: string
    telephone: string
    rc: string
    ice: string
    tp: string
    cnss?: string
  }
  ticket: {
    numero: string
    date: string
    heure: string
    caisse: string
    caissier: string
  }
  client?: {
    nom: string
    ice: string
    rc?: string
    adresse: string
  }
  articles: Array<{
    designation: string
    quantite: number
    prix_unitaire: number
    tva: number
    montant_ht: number
    montant_tva: number
    montant_ttc: number
  }>
  total: {
    montant_ht: number
    montant_tva_10: number
    montant_tva_14: number
    montant_tva_20: number
    montant_ttc: number
    arrondi: number
    net_a_payer: number
  }
  paiement: {
    mode: string
    recu: number
    rendu: number
  }
  mentions: string[]
  qr_code?: string
}

export function MoroccanPOSSystem() {
  const { toast } = useToast()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      code: 'P001',
      name: 'Café Nescafé Classic 200g',
      name_arabic: 'قهوة نسكافيه كلاسيك 200غ',
      barcode: '7612100012345',
      category: 'Epicerie',
      price: 32.50,
      tva_rate: 0.2,
      unit: 'Pièce',
      stock: 45,
      min_stock: 10,
      supplier: 'Nestlé Maroc',
      cost_price: 25.00,
      margin: 30
    },
    {
      id: '2',
      code: 'P002',
      name: 'Lait Centrale Danone 1L',
      name_arabic: 'حليب سنترال دانون 1لتر',
      barcode: '6111111111111',
      category: 'Laitiers',
      price: 8.90,
      tva_rate: 0.14,
      unit: 'Pièce',
      stock: 120,
      min_stock: 20,
      supplier: 'Centrale Danone',
      cost_price: 6.50,
      margin: 37
    },
    {
      id: '3',
      code: 'P003',
      name: 'Huile Lesieur 1L',
      name_arabic: 'زيت ليشر 1لتر',
      barcode: '3560070812345',
      category: 'Huiles',
      price: 22.00,
      tva_rate: 0.14,
      unit: 'Pièce',
      stock: 85,
      min_stock: 15,
      supplier: 'Lesieur Cristal',
      cost_price: 17.00,
      margin: 29
    },
    {
      id: '4',
      code: 'P004',
      name: 'Sucre Surac 1kg',
      name_arabic: 'سكر سوراك 1كغ',
      barcode: '6112222222222',
      category: 'Epicerie',
      price: 11.50,
      tva_rate: 0.1,
      unit: 'Paquet',
      stock: 200,
      min_stock: 50,
      supplier: 'Cosumar',
      cost_price: 8.50,
      margin: 35
    },
    {
      id: '5',
      code: 'P005',
      name: 'Farine Minoterie 2kg',
      name_arabic: 'دقيق المطحنة 2كغ',
      barcode: '6113333333333',
      category: 'Farines',
      price: 18.00,
      tva_rate: 0.1,
      unit: 'Sac',
      stock: 150,
      min_stock: 30,
      supplier: 'Minoterie',
      cost_price: 13.00,
      margin: 38
    }
  ])
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: '1',
      code: 'C001',
      name: 'Mohamed Amine',
      phone: '0612345678',
      city: 'Casablanca',
      ice: '001234567890123',
      rc: '12345',
      credit_limit: 50000,
      credit_used: 12000,
      is_vip: true
    },
    {
      id: '2',
      code: 'C002',
      name: 'Fatima Zahra',
      phone: '0623456789',
      city: 'Rabat',
      credit_limit: 20000,
      credit_used: 5000,
      is_vip: false
    }
  ])
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [currentReceipt, setCurrentReceipt] = useState<MoroccanReceipt | null>(null)
  const [activeShift, setActiveShift] = useState<Shift>({
    id: 'SHIFT001',
    cashier: 'Youssef EL BACHIRI',
    start_time: new Date(),
    opening_balance: 5000,
    cash_sales: 0,
    card_sales: 0,
    cheque_sales: 0,
    total_sales: 0,
    expected_cash: 5000,
    status: 'open'
  })
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [quickAmounts] = useState([20, 50, 100, 200, 500])
  const [isProcessing, setIsProcessing] = useState(false)

  // Calculate cart totals with Moroccan VAT calculations
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => {
      const itemTotal = item.product.price * item.quantity
      const discountAmount = itemTotal * (item.discount / 100)
      return sum + (itemTotal - discountAmount)
    }, 0)

    // Calculate TVA by rate (Moroccan rates)
    const tvaByRate = {
      tva_10: 0,
      tva_14: 0,
      tva_20: 0
    }

    cart.forEach(item => {
      const itemTotal = item.product.price * item.quantity
      const discountAmount = itemTotal * (item.discount / 100)
      const netAmount = itemTotal - discountAmount
      const tvaAmount = netAmount * item.product.tva_rate
      
      if (item.product.tva_rate === 0.1) tvaByRate.tva_10 += tvaAmount
      else if (item.product.tva_rate === 0.14) tvaByRate.tva_14 += tvaAmount
      else if (item.product.tva_rate === 0.2) tvaByRate.tva_20 += tvaAmount
    })

    const tvaTotal = Object.values(tvaByRate).reduce((a, b) => a + b, 0)
    const total = subtotal + tvaTotal
    const totalRounded = Math.round(total * 100) / 100
    const arrondi = totalRounded - total

    return {
      subtotal,
      tvaByRate,
      tvaTotal,
      total,
      totalRounded,
      arrondi,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    }
  }, [cart])

  // Handle barcode scanning
  useEffect(() => {
    const handleBarcode = (e: KeyboardEvent) => {
      if (barcodeRef.current && e.target === barcodeRef.current) {
        if (e.key === 'Enter') {
          const barcode = barcodeRef.current.value.trim()
          if (barcode) {
            scanProduct(barcode)
            barcodeRef.current.value = ''
          }
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleBarcode)
    return () => document.removeEventListener('keydown', handleBarcode)
  }, [])

  const scanProduct = useCallback((barcode: string) => {
    const product = products.find(p => p.barcode === barcode)
    if (product) {
      addToCart(product)
      toast({
        title: "Produit scanné",
        description: `${product.name} ajouté au panier`,
      })
    } else {
      toast({
        title: "Produit non trouvé",
        description: "Scannez à nouveau ou recherchez manuellement",
        variant: "destructive"
      })
    }
  }, [products, toast])

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        return [...prev, {
          product,
          quantity: 1,
          discount: 0,
          subtotal: product.price,
          tva_amount: product.price * product.tva_rate
        }]
      }
    })
  }, [])

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta)
        if (newQuantity > item.product.stock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible: ${item.product.stock}`,
            variant: "destructive"
          })
          return item
        }
        return { ...item, quantity: newQuantity }
      }
      return item
    }))
  }, [toast])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }, [])

  const applyDiscount = useCallback((productId: string, discount: number) => {
    setCart(prev => prev.map(item =>
      item.product.id === productId
        ? { ...item, discount: Math.min(100, Math.max(0, discount)) }
        : item
    ))
  }, [])

  const processPayment = useCallback(async () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant de procéder au paiement",
        variant: "destructive"
      })
      return
    }

    const paid = parseFloat(amountPaid) || 0
    const change = paid - cartTotals.totalRounded

    if (paymentMethod === 'cash' && paid < cartTotals.totalRounded) {
      toast({
        title: "Montant insuffisant",
        description: `Il manque ${(cartTotals.totalRounded - paid).toFixed(2)} MAD`,
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)

    try {
      // Generate receipt number (Moroccan format: YYMMDD-XXXX)
      const now = new Date()
      const receiptNumber = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

      // Create Moroccan receipt
      const receipt: MoroccanReceipt = {
        en_tete: {
          raison_sociale: "SUPERMARCHÉ AL AMINE",
          adresse: "123 Avenue Hassan II, Casablanca",
          telephone: "0522-123456",
          rc: "12345 Casablanca",
          ice: "001234567890123",
          tp: "TP1234567",
          cnss: "J123456789"
        },
        ticket: {
          numero: receiptNumber,
          date: now.toLocaleDateString('fr-FR'),
          heure: now.toLocaleTimeString('fr-FR'),
          caisse: "CAISSE 01",
          caissier: activeShift.cashier
        },
        client: currentCustomer ? {
          nom: currentCustomer.name,
          ice: currentCustomer.ice || '',
          rc: currentCustomer.rc || '',
          adresse: currentCustomer.address || currentCustomer.city
        } : undefined,
        articles: cart.map(item => ({
          designation: item.product.name,
          quantite: item.quantity,
          prix_unitaire: item.product.price,
          tva: item.product.tva_rate * 100,
          montant_ht: (item.product.price * item.quantity) * (1 - item.discount / 100),
          montant_tva: ((item.product.price * item.quantity) * (1 - item.discount / 100)) * item.product.tva_rate,
          montant_ttc: (item.product.price * item.quantity) * (1 - item.discount / 100) * (1 + item.product.tva_rate)
        })),
        total: {
          montant_ht: cartTotals.subtotal,
          montant_tva_10: cartTotals.tvaByRate.tva_10,
          montant_tva_14: cartTotals.tvaByRate.tva_14,
          montant_tva_20: cartTotals.tvaByRate.tva_20,
          montant_ttc: cartTotals.total,
          arrondi: cartTotals.arrondi,
          net_a_payer: cartTotals.totalRounded
        },
        paiement: {
          mode: getPaymentMethodLabel(paymentMethod),
          recu: paid,
          rendu: Math.max(0, change)
        },
        mentions: [
          "TVA incluse selon les taux en vigueur",
          "Ticket à conserver pendant 30 jours",
          "Échange possible sous 7 jours avec ticket",
          "Merci de votre visite et à bientôt"
        ]
      }

      // Update shift
      setActiveShift(prev => ({
        ...prev,
        cash_sales: prev.cash_sales + (paymentMethod === 'cash' ? cartTotals.totalRounded : 0),
        card_sales: prev.card_sales + (paymentMethod === 'credit_card' ? cartTotals.totalRounded : 0),
        cheque_sales: prev.cheque_sales + (paymentMethod === 'cheque' ? cartTotals.totalRounded : 0),
        total_sales: prev.total_sales + cartTotals.totalRounded,
        expected_cash: prev.opening_balance + prev.cash_sales + (paymentMethod === 'cash' ? cartTotals.totalRounded : 0)
      }))

      // Update product stock
      setProducts(prev => prev.map(product => {
        const cartItem = cart.find(item => item.product.id === product.id)
        if (cartItem) {
          return { ...product, stock: product.stock - cartItem.quantity }
        }
        return product
      }))

      // Update customer credit if applicable
      if (currentCustomer && paymentMethod === 'credit') {
        setCustomers(prev => prev.map(c => 
          c.id === currentCustomer.id 
            ? { ...c, credit_used: c.credit_used + cartTotals.totalRounded }
            : c
        ))
      }

      // Show receipt
      setCurrentReceipt(receipt)
      setShowReceiptModal(true)

      // Reset cart
      setCart([])
      setAmountPaid('')
      
      toast({
        title: "Paiement réussi",
        description: `Ticket #${receiptNumber} généré`,
        duration: 3000,
      })

    } catch (error) {
      toast({
        title: "Erreur de paiement",
        description: "Veuillez réessayer",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [cart, cartTotals, paymentMethod, amountPaid, currentCustomer, activeShift, toast])

  const printReceipt = useCallback(() => {
    // Implement receipt printing logic
    const printContent = document.getElementById('receipt-content')
    if (printContent) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Ticket de Caisse</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; }
              .receipt { width: 80mm; margin: 0 auto; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .border-top { border-top: 1px dashed #000; }
              .bold { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 2px 0; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }, [])

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    const labels = {
      cash: 'Espèces',
      credit_card: 'Carte Bancaire',
      cheque: 'Chèque',
      mobile_money: 'Mobile Money',
      bank_transfer: 'Virement'
    }
    return labels[method]
  }

  // Moroccan currency formatting
  const formatMAD = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.name_arabic.includes(searchQuery) ||
    product.code.includes(searchQuery) ||
    product.barcode.includes(searchQuery)
  )

  return (
    <div className={cn(
      "h-screen flex flex-col",
      theme === 'dark' ? "dark bg-gray-900" : "bg-gray-50"
    )}>
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-8 w-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  CAISSE ENREGISTREUSE
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeShift.cashier} • Caise #01 • Shift: {activeShift.id}
                </p>
              </div>
            </div>
            
            <Badge variant={activeShift.status === 'open' ? 'default' : 'secondary'}>
              {activeShift.status === 'open' ? '🟢 Shift Ouvert' : '🔴 Shift Fermé'}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatMAD(activeShift.expected_cash)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Caisse théorique
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                  {theme === 'light' ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                  {theme === 'light' ? 'Mode Sombre' : 'Mode Clair'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  Changer de caissier
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Lock className="h-4 w-4 mr-2" />
                  Verrouiller la caisse
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Shield className="h-4 w-4 mr-2" />
                  Rapports DGTR
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Products Panel - Left */}
        <div className="col-span-8 grid grid-rows-6 gap-4">
          {/* Search & Barcode */}
          <Card className="row-span-1">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher produit (nom, code, code-barres)..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="w-64">
                  <Input
                    ref={barcodeRef}
                    placeholder="Scanner code-barres..."
                    className="font-mono text-center"
                  />
                </div>
                <Button onClick={() => setShowCustomerModal(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Client
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <Card className="row-span-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Produits ({products.length})</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">Épicerie</Badge>
                  <Badge variant="outline">Laitiers</Badge>
                  <Badge variant="outline">Boissons</Badge>
                  <Badge variant="outline">Tous</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <Card 
                      key={product.id}
                      className={cn(
                        "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
                        product.stock <= product.min_stock && "border-red-300 bg-red-50 dark:bg-red-900/20"
                      )}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">{product.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {product.name_arabic}
                            </p>
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                              <div>Code: {product.code}</div>
                              <div>Stock: {product.stock} {product.unit}</div>
                              <div>TVA: {product.tva_rate * 100}%</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatMAD(product.price)}
                            </div>
                            {product.stock <= product.min_stock && (
                              <Badge variant="destructive" className="mt-2 text-xs">
                                Stock faible
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 text-xs font-mono text-gray-400">
                          ⌨ {product.barcode}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Cart & Payment Panel - Right */}
        <div className="col-span-4 grid grid-rows-6 gap-4">
          {/* Current Cart */}
          <Card className="row-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Panier ({cartTotals.itemCount} articles)</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCart([])}
                  disabled={cart.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vider
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <ShoppingCart className="h-12 w-12 mb-4" />
                    <p>Panier vide</p>
                    <p className="text-sm">Ajoutez des produits</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatMAD(item.product.price)} × {item.quantity} 
                            {item.discount > 0 && ` -${item.discount}%`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stock}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6">
                                <Percent className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {[0, 5, 10, 15, 20].map(discount => (
                                <DropdownMenuItem
                                  key={discount}
                                  onClick={() => applyDiscount(item.product.id, discount)}
                                >
                                  {discount}% de réduction
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Totals & Payment */}
          <Card className="row-span-3">
            <CardContent className="p-6">
              {/* Totals Display */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sous-total HT:</span>
                  <span className="font-medium">{formatMAD(cartTotals.subtotal)}</span>
                </div>
                
                {/* Moroccan TVA Breakdown */}
                {cartTotals.tvaByRate.tva_10 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TVA 10%:</span>
                    <span className="font-medium">{formatMAD(cartTotals.tvaByRate.tva_10)}</span>
                  </div>
                )}
                {cartTotals.tvaByRate.tva_14 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TVA 14%:</span>
                    <span className="font-medium">{formatMAD(cartTotals.tvaByRate.tva_14)}</span>
                  </div>
                )}
                {cartTotals.tvaByRate.tva_20 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TVA 20%:</span>
                    <span className="font-medium">{formatMAD(cartTotals.tvaByRate.tva_20)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total TTC:</span>
                  <span>{formatMAD(cartTotals.totalRounded)}</span>
                </div>
                
                {cartTotals.arrondi !== 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Arrondi:</span>
                    <span>{formatMAD(cartTotals.arrondi)}</span>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Mode de paiement</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'credit_card', 'cheque'] as PaymentMethod[]).map(method => (
                    <Button
                      key={method}
                      variant={paymentMethod === method ? "default" : "outline"}
                      className="h-10"
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method === 'cash' && <Cash className="h-4 w-4 mr-2" />}
                      {method === 'credit_card' && <CreditCard className="h-4 w-4 mr-2" />}
                      {method === 'cheque' && <Receipt className="h-4 w-4 mr-2" />}
                      {getPaymentMethodLabel(method)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Amount Paid */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Montant payé</div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    placeholder="Montant en MAD"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setAmountPaid(cartTotals.totalRounded.toString())}
                  >
                    Total
                  </Button>
                </div>
                
                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-5 gap-2">
                  {quickAmounts.map(amount => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountPaid(prev => {
                        const current = parseFloat(prev) || 0
                        return (current + amount).toString()
                      })}
                    >
                      +{amount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Change Calculation */}
              {paymentMethod === 'cash' && amountPaid && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">À rendre:</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatMAD(Math.max(0, parseFloat(amountPaid) - cartTotals.totalRounded))}
                    </span>
                  </div>
                </div>
              )}

              {/* Pay Button */}
              <Button
                size="lg"
                className="w-full h-12 text-lg"
                onClick={processPayment}
                disabled={cart.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Traitement...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    {paymentMethod === 'cash' ? 'Payer en espèces' : 'Finaliser le paiement'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sélectionner un client</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {customers.map(customer => (
                <Card
                  key={customer.id}
                  className={cn(
                    "cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800",
                    currentCustomer?.id === customer.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => {
                    setCurrentCustomer(customer)
                    setShowCustomerModal(false)
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{customer.name}</h3>
                          {customer.is_vip && (
                            <Badge variant="default">VIP</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          📞 {customer.phone} • 📍 {customer.city}
                        </div>
                        {customer.ice && (
                          <div className="text-xs font-mono mt-1">
                            ICE: {customer.ice}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          Crédit: {formatMAD(customer.credit_limit - customer.credit_used)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Limite: {formatMAD(customer.credit_limit)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrentCustomer(null)}>
              Aucun client
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket de Caisse</DialogTitle>
          </DialogHeader>
          {currentReceipt && (
            <div id="receipt-content" className="font-mono text-sm">
              {/* Receipt Header */}
              <div className="text-center border-b pb-4 mb-4">
                <h2 className="text-xl font-bold">{currentReceipt.en_tete.raison_sociale}</h2>
                <p>{currentReceipt.en_tete.adresse}</p>
                <p>Tél: {currentReceipt.en_tete.telephone}</p>
                <p className="text-xs">
                  RC: {currentReceipt.en_tete.rc} • 
                  ICE: {currentReceipt.en_tete.ice} • 
                  TP: {currentReceipt.en_tete.tp}
                </p>
              </div>

              {/* Ticket Info */}
              <div className="mb-4">
                <div className="flex justify-between">
                  <span>Ticket:</span>
                  <span className="font-bold">{currentReceipt.ticket.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{currentReceipt.ticket.date} {currentReceipt.ticket.heure}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caisse:</span>
                  <span>{currentReceipt.ticket.caisse}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caissier:</span>
                  <span>{currentReceipt.ticket.caissier}</span>
                </div>
              </div>

              {/* Customer Info */}
              {currentReceipt.client && (
                <div className="border-t pt-3 mb-4">
                  <div className="font-bold mb-2">CLIENT:</div>
                  <div>{currentReceipt.client.nom}</div>
                  {currentReceipt.client.ice && <div>ICE: {currentReceipt.client.ice}</div>}
                  {currentReceipt.client.rc && <div>RC: {currentReceipt.client.rc}</div>}
                  <div>{currentReceipt.client.adresse}</div>
                </div>
              )}

              {/* Articles */}
              <div className="border-y py-3 mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Désignation</th>
                      <th className="text-right">Qté</th>
                      <th className="text-right">PU</th>
                      <th className="text-right">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReceipt.articles.map((article, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-1">{article.designation}</td>
                        <td className="text-right">{article.quantite}</td>
                        <td className="text-right">{article.prix_unitaire.toFixed(2)}</td>
                        <td className="text-right">{article.montant_ttc.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>Total HT:</span>
                  <span>{currentReceipt.total.montant_ht.toFixed(2)} MAD</span>
                </div>
                {currentReceipt.total.montant_tva_10 > 0 && (
                  <div className="flex justify-between">
                    <span>TVA 10%:</span>
                    <span>{currentReceipt.total.montant_tva_10.toFixed(2)} MAD</span>
                  </div>
                )}
                {currentReceipt.total.montant_tva_14 > 0 && (
                  <div className="flex justify-between">
                    <span>TVA 14%:</span>
                    <span>{currentReceipt.total.montant_tva_14.toFixed(2)} MAD</span>
                  </div>
                )}
                {currentReceipt.total.montant_tva_20 > 0 && (
                  <div className="flex justify-between">
                    <span>TVA 20%:</span>
                    <span>{currentReceipt.total.montant_tva_20.toFixed(2)} MAD</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>NET À PAYER:</span>
                  <span>{currentReceipt.total.net_a_payer.toFixed(2)} MAD</span>
                </div>
              </div>

              {/* Payment */}
              <div className="border-t pt-3 mb-4">
                <div className="flex justify-between">
                  <span>Mode paiement:</span>
                  <span>{currentReceipt.paiement.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Montant reçu:</span>
                  <span>{currentReceipt.paiement.recu.toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Monnaie rendue:</span>
                  <span>{currentReceipt.paiement.rendu.toFixed(2)} MAD</span>
                </div>
              </div>

              {/* Mentions */}
              <div className="text-xs text-center text-gray-500 border-t pt-3">
                {currentReceipt.mentions.map((mention, idx) => (
                  <p key={idx} className="mb-1">{mention}</p>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={printReceipt}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
            <Button onClick={() => setShowReceiptModal(false)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Terminer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Additional Moroccan POS components

// Moroccan VAT Calculator Component
export function MoroccanVATCalculator() {
  const [amount, setAmount] = useState('')
  const [tvaRate, setTvaRate] = useState<TVARate>(0.2)
  
  const calculateVAT = () => {
    const numAmount = parseFloat(amount) || 0
    const tvaAmount = numAmount * tvaRate
    const total = numAmount + tvaAmount
    
    return {
      ht: numAmount,
      tva: tvaAmount,
      ttc: total,
      rate: tvaRate * 100
    }
  }
  
  const results = calculateVAT()
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Calculateur TVA Maroc</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Montant HT (MAD)</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Entrez le montant HT"
          />
        </div>
        
        <div>
          <Label>Taux de TVA</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([0.1, 0.14, 0.2] as TVARate[]).map(rate => (
              <Button
                key={rate}
                variant={tvaRate === rate ? "default" : "outline"}
                onClick={() => setTvaRate(rate)}
                className="w-full"
              >
                {rate * 100}%
              </Button>
            ))}
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Montant HT:</span>
            <span className="font-bold">{results.ht.toFixed(2)} MAD</span>
          </div>
          <div className="flex justify-between">
            <span>TVA ({results.rate}%):</span>
            <span className="font-bold text-red-600">{results.tva.toFixed(2)} MAD</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total TTC:</span>
            <span className="text-green-600">{results.ttc.toFixed(2)} MAD</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Shift Management Component
export function ShiftManager() {
  const [shifts, setShifts] = useState<Shift[]>([
    {
      id: 'SHIFT001',
      cashier: 'Youssef EL BACHIRI',
      start_time: new Date('2024-01-15T08:00:00'),
      end_time: new Date('2024-01-15T16:00:00'),
      opening_balance: 5000,
      closing_balance: 15320,
      cash_sales: 8320,
      card_sales: 4500,
      cheque_sales: 2500,
      total_sales: 15320,
      expected_cash: 13320,
      difference: 0,
      status: 'closed'
    }
  ])
  
  const openShift = () => {
    const newShift: Shift = {
      id: `SHIFT${(shifts.length + 1).toString().padStart(3, '0')}`,
      cashier: 'Caissier',
      start_time: new Date(),
      opening_balance: 5000,
      cash_sales: 0,
      card_sales: 0,
      cheque_sales: 0,
      total_sales: 0,
      expected_cash: 5000,
      status: 'open'
    }
    setShifts([newShift, ...shifts])
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion des Shifts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={openShift} className="w-full">
            <Clock className="h-4 w-4 mr-2" />
            Ouvrir un nouveau shift
          </Button>
          
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {shifts.map(shift => (
                <Card key={shift.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{shift.id}</div>
                        <div className="text-sm text-gray-500">
                          {shift.cashier} • {shift.start_time.toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                          {shift.status === 'open' ? '🟢 Ouvert' : '🔴 Fermé'}
                        </Badge>
                        <div className="font-bold mt-1">{shift.total_sales.toFixed(2)} MAD</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
