import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowDownCircle, ArrowUpCircle, ShoppingCart, ShoppingBag, Wallet, Filter, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";

interface Movimiento {
  id_movimiento: string;
  fecha: string;
  tipo: string;
  monto: number;
  metodo_pago: string | null;
  concepto: string | null;
}

interface MetodoPagoStats {
  metodo: string;
  total: number;
}

interface PeriodoStats {
  entradas: number;
  salidas: number;
  saldo: number;
  porMetodo: MetodoPagoStats[];
}

const CajaTab = () => {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totales, setTotales] = useState({ entradas: 0, salidas: 0, saldo: 0 });
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [metodoFiltro, setMetodoFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [fechaFiltro, setFechaFiltro] = useState<"hoy" | "semana" | "mes" | "todos">("todos");
  const [statsPeriodo, setStatsPeriodo] = useState<PeriodoStats>({
    entradas: 0,
    salidas: 0,
    saldo: 0,
    porMetodo: [],
  });

  // Estados para los diálogos de movimientos
  const [dialogVenta, setDialogVenta] = useState(false);
  const [dialogCompra, setDialogCompra] = useState(false);
  const [dialogRetiro, setDialogRetiro] = useState(false);
  const [formMovimiento, setFormMovimiento] = useState({
    monto: "",
    metodo_pago: "",
    concepto: "",
  });

  // Estados para venta con artículos
  const [articulos, setArticulos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [articulosVenta, setArticulosVenta] = useState<Array<{ id_articulo: string; cantidad: number; precio: number }>>([]);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState("");
  const [cantidadArticulo, setCantidadArticulo] = useState("1");
  const [clienteSeleccionado, setClienteSeleccionado] = useState("sin_cliente");
  const [metodoPagoVenta, setMetodoPagoVenta] = useState("");
  const [openArticuloPopover, setOpenArticuloPopover] = useState(false);

  useEffect(() => {
    fetchMovimientos();
    fetchArticulos();
    fetchClientes();
  }, []);

  useEffect(() => {
    calcularStatsPeriodo();
  }, [movimientos, periodo]);

  const calcularStatsPeriodo = () => {
    const now = new Date();
    let fechaInicio: Date;

    if (periodo === "dia") {
      fechaInicio = new Date(now.setHours(0, 0, 0, 0));
    } else if (periodo === "semana") {
      const dia = now.getDay();
      const diff = dia === 0 ? 6 : dia - 1;
      fechaInicio = new Date(now.setDate(now.getDate() - diff));
      fechaInicio.setHours(0, 0, 0, 0);
    } else {
      fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const movsFiltrados = movimientos.filter(
      (m) => new Date(m.fecha) >= fechaInicio
    );

    const entradas = movsFiltrados
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const salidas = movsFiltrados
      .filter((m) => m.tipo === "salida")
      .reduce((acc, m) => acc + Number(m.monto), 0);

    // Calcular por método de pago
    const porMetodoMap = new Map<string, number>();
    movsFiltrados
      .filter((m) => m.tipo === "entrada")
      .forEach((m) => {
        const metodo = m.metodo_pago || "sin_especificar";
        porMetodoMap.set(metodo, (porMetodoMap.get(metodo) || 0) + Number(m.monto));
      });

    const porMetodo = Array.from(porMetodoMap.entries()).map(([metodo, total]) => ({
      metodo,
      total,
    }));

    setStatsPeriodo({
      entradas,
      salidas,
      saldo: entradas - salidas,
      porMetodo,
    });
  };

  const fetchMovimientos = async () => {
    const { data, error } = await supabase
      .from("movimientos_caja")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(200);

    if (!error && data) {
      const normalized = (data as any[]).map((m) => ({
        id_movimiento: m.id_movimiento,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: Number(m.monto),
        metodo_pago: m.metodo_pago ?? m.medio_pago ?? null,
        concepto: m.concepto ?? m.descripcion ?? null,
      }));

      setMovimientos(normalized);

      const entradas = normalized
        .filter((m) => m.tipo === "entrada")
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const salidas = normalized
        .filter((m) => m.tipo === "salida")
        .reduce((acc, m) => acc + Number(m.monto), 0);

      setTotales({
        entradas,
        salidas,
        saldo: entradas - salidas,
      });
    }
  };

  const fetchArticulos = async () => {
    const { data, error } = await supabase
      .from("articulos")
      .select("*")
      .eq("activo", true)
      .gt("stock_disponible", 0)
      .order("nombre");

    if (!error && data) {
      setArticulos(data);
    }
  };

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id_cliente, nombre, apellido")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setClientes(data);
    }
  };

  const metodoPagoLabels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta_debito: "Tarjeta Débito",
    tarjeta_credito: "Tarjeta Crédito",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    cuenta_corriente: "Cuenta Corriente",
    sin_especificar: "Sin especificar",
  };

  const agregarArticuloVenta = () => {
    if (!articuloSeleccionado) {
      toast.error("Selecciona un artículo");
      return;
    }

    const articulo = articulos.find(a => a.id_articulo === articuloSeleccionado);
    if (!articulo) return;

    const cantidad = parseInt(cantidadArticulo);
    if (cantidad <= 0 || cantidad > articulo.stock_disponible) {
      toast.error(`Stock disponible: ${articulo.stock_disponible}`);
      return;
    }

    setArticulosVenta([...articulosVenta, {
      id_articulo: articulo.id_articulo,
      cantidad,
      precio: articulo.precio_venta,
    }]);

    setArticuloSeleccionado("");
    setCantidadArticulo("1");
    toast.success(`${articulo.nombre} agregado`);
  };

  const eliminarArticuloVenta = (index: number) => {
    setArticulosVenta(articulosVenta.filter((_, i) => i !== index));
  };

  const calcularTotalVenta = () => {
    return articulosVenta.reduce((total, item) => total + (item.cantidad * item.precio), 0);
  };

  const registrarVentaConArticulos = async () => {
    if (articulosVenta.length === 0) {
      toast.error("Agrega al menos un artículo");
      return;
    }

    if (!metodoPagoVenta) {
      toast.error("Selecciona un método de pago");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const total = calcularTotalVenta();

    // Crear la venta
    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        id_cliente: clienteSeleccionado === "sin_cliente" ? null : clienteSeleccionado,
        total,
        estado: "pago",
        metodo_pago: metodoPagoVenta,
        user_id: user.id,
      })
      .select()
      .single();

    if (ventaError || !venta) {
      toast.error("Error al crear la venta");
      return;
    }

    // Crear los detalles de venta
    const detalles = articulosVenta.map(item => ({
      id_venta: venta.id_venta,
      id_articulo: item.id_articulo,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      estado_articulo: "pago",
      user_id: user.id,
    }));

    const { error: detallesError } = await supabase
      .from("detalle_venta")
      .insert(detalles);

    if (detallesError) {
      toast.error("Error al registrar los artículos");
      return;
    }

    // ⚠️ NO registrar manualmente en caja - el trigger de la BD lo hace automáticamente
    // cuando se inserta un detalle_venta con estado 'pago'

    toast.success("Venta registrada exitosamente");
    
    // Resetear formulario
    setArticulosVenta([]);
    setClienteSeleccionado("sin_cliente");
    setMetodoPagoVenta("");
    setDialogVenta(false);
    
    fetchMovimientos();
    fetchArticulos();
  };

  const registrarMovimiento = async (tipo: "entrada" | "salida", conceptoBase: string) => {
    if (!formMovimiento.monto || parseFloat(formMovimiento.monto) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("movimientos_caja" as any).insert({
      tipo,
      monto: parseFloat(formMovimiento.monto),
      medio_pago: formMovimiento.metodo_pago || null,
      descripcion: formMovimiento.concepto || conceptoBase,
      user_id: user.id,
    } as any);

    if (error) {
      toast.error("Error al registrar el movimiento");
      return;
    }

    toast.success(`${conceptoBase} registrada exitosamente`);
    setFormMovimiento({ monto: "", metodo_pago: "", concepto: "" });
    setDialogVenta(false);
    setDialogCompra(false);
    setDialogRetiro(false);
    fetchMovimientos();
  };

  const movimientosFiltrados = movimientos.filter((m) => {
    // Filtro por método de pago
    if (metodoFiltro !== "todos" && m.metodo_pago !== metodoFiltro) {
      return false;
    }
    
    // Filtro por tipo
    if (tipoFiltro !== "todos" && m.tipo !== tipoFiltro) {
      return false;
    }
    
    // Filtro por fecha
    if (fechaFiltro !== "todos") {
      const fechaMov = new Date(m.fecha);
      const hoy = new Date();
      
      if (fechaFiltro === "hoy") {
        const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0));
        if (fechaMov < inicioHoy) return false;
      } else if (fechaFiltro === "semana") {
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - 7));
        if (fechaMov < inicioSemana) return false;
      } else if (fechaFiltro === "mes") {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        if (fechaMov < inicioMes) return false;
      }
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Botones de Acción Rápida */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button
          onClick={() => setDialogVenta(true)}
          className="h-24 text-xl font-bold bg-emerald-500/90 hover:bg-emerald-500 shadow-soft"
          size="lg"
        >
          <ShoppingCart className="mr-3 h-8 w-8" />
          Registrar Venta
        </Button>
        <Button
          onClick={() => setDialogCompra(true)}
          className="h-24 text-xl font-bold bg-amber-500/90 hover:bg-amber-500 shadow-soft"
          size="lg"
        >
          <ShoppingBag className="mr-3 h-8 w-8" />
          Registrar Compra
        </Button>
        <Button
          onClick={() => setDialogRetiro(true)}
          className="h-24 text-xl font-bold bg-slate-500/90 hover:bg-slate-500 shadow-soft"
          size="lg"
        >
          <Wallet className="mr-3 h-8 w-8" />
          Registrar Retiro
        </Button>
      </div>

      {/* Diálogos de Movimientos */}
      <Dialog open={dialogVenta} onOpenChange={setDialogVenta}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
              Registrar Venta en Caja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente (opcional) */}
            <div>
              <Label className="text-base">Cliente (opcional)</Label>
              <Select value={clienteSeleccionado} onValueChange={setClienteSeleccionado}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Cliente general" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_cliente">Cliente general</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id_cliente} value={cliente.id_cliente}>
                      {cliente.nombre} {cliente.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleccionar Artículos */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold mb-3 block">Agregar Artículos</Label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="col-span-2">
                  <Popover open={openArticuloPopover} onOpenChange={setOpenArticuloPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-10"
                      >
                        {articuloSeleccionado
                          ? articulos.find((art) => art.id_articulo === articuloSeleccionado)?.nombre
                          : "Buscar artículo..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por código o nombre..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron artículos.</CommandEmpty>
                          <CommandGroup>
                            {articulos.map((art) => (
                              <CommandItem
                                key={art.id_articulo}
                                value={`${art.codigo} ${art.nombre}`}
                                onSelect={() => {
                                  setArticuloSeleccionado(art.id_articulo);
                                  setOpenArticuloPopover(false);
                                }}
                              >
                                <div className="flex justify-between w-full">
                                  <span>
                                    {art.codigo} - {art.nombre}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ${art.precio_venta} | Stock: {art.stock_disponible}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  type="number"
                  min="1"
                  value={cantidadArticulo}
                  onChange={(e) => setCantidadArticulo(e.target.value)}
                  placeholder="Cant."
                />
              </div>
              <Button
                onClick={agregarArticuloVenta}
                variant="outline"
                className="w-full"
              >
                + Agregar al carrito
              </Button>
            </div>

            {/* Lista de artículos agregados */}
            {articulosVenta.length > 0 && (
              <div className="border rounded-lg p-4">
                <Label className="text-base font-semibold mb-3 block">Artículos en la venta</Label>
                <div className="space-y-2">
                  {articulosVenta.map((item, index) => {
                    const art = articulos.find(a => a.id_articulo === item.id_articulo);
                    return (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="flex-1">
                          {art?.codigo} - {art?.nombre} x {item.cantidad}
                        </span>
                        <span className="font-bold mx-4">
                          {formatCurrency(item.cantidad * item.precio)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarArticuloVenta(index)}
                          className="text-rose-500 hover:text-rose-600"
                        >
                          ✕
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(calcularTotalVenta())}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Método de Pago */}
            <div>
              <Label className="text-base">Método de Pago *</Label>
              <Select value={metodoPagoVenta} onValueChange={setMetodoPagoVenta}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                  <SelectItem value="tarjeta_debito">💳 Tarjeta Débito</SelectItem>
                  <SelectItem value="tarjeta_credito">💳 Tarjeta Crédito</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                  <SelectItem value="mercadopago">📱 MercadoPago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={registrarVentaConArticulos}
              className="w-full h-14 text-lg bg-emerald-500/90 hover:bg-emerald-500"
            >
              Confirmar Venta - {formatCurrency(calcularTotalVenta())}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogCompra} onOpenChange={setDialogCompra}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-amber-600" />
              Registrar Compra/Gasto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="monto-compra" className="text-base">Monto *</Label>
              <Input
                id="monto-compra"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formMovimiento.monto}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, monto: e.target.value })}
                className="text-2xl h-14 text-center"
              />
            </div>
            <div>
              <Label className="text-base">Método de Pago</Label>
              <Select
                value={formMovimiento.metodo_pago}
                onValueChange={(value) => setFormMovimiento({ ...formMovimiento, metodo_pago: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta Débito</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base">Concepto/Descripción *</Label>
              <Textarea
                placeholder="Ej: Compra de mercadería, pago de servicios..."
                value={formMovimiento.concepto}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, concepto: e.target.value })}
                className="min-h-20"
              />
            </div>
            <Button
              onClick={() => registrarMovimiento("salida", "Compra")}
              className="w-full h-12 text-lg bg-amber-500/90 hover:bg-amber-500"
            >
              Confirmar Compra
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogRetiro} onOpenChange={setDialogRetiro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Wallet className="h-6 w-6 text-slate-600" />
              Registrar Retiro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="monto-retiro" className="text-base">Monto *</Label>
              <Input
                id="monto-retiro"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formMovimiento.monto}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, monto: e.target.value })}
                className="text-2xl h-14 text-center"
              />
            </div>
            <div>
              <Label className="text-base">Concepto/Motivo *</Label>
              <Textarea
                placeholder="Ej: Retiro para gastos personales, caja chica..."
                value={formMovimiento.concepto}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, concepto: e.target.value })}
                className="min-h-20"
              />
            </div>
            <Button
              onClick={() => registrarMovimiento("salida", "Retiro")}
              className="w-full h-12 text-lg bg-slate-500/90 hover:bg-slate-500"
            >
              Confirmar Retiro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumen del Período Actual */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Resumen del Período</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={periodo === "dia" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("dia")}
              >
                Hoy
              </Button>
              <Button
                variant={periodo === "semana" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("semana")}
              >
                Semana
              </Button>
              <Button
                variant={periodo === "mes" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("mes")}
              >
                Mes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Entradas
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(statsPeriodo.entradas)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
              <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
                Salidas
              </p>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {formatCurrency(statsPeriodo.salidas)}
              </p>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                statsPeriodo.saldo >= 0
                  ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900"
                  : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  statsPeriodo.saldo >= 0
                    ? "text-sky-900 dark:text-sky-100"
                    : "text-amber-900 dark:text-amber-100"
                }`}
              >
                Saldo
              </p>
              <p
                className={`text-2xl font-bold ${
                  statsPeriodo.saldo >= 0
                    ? "text-sky-700 dark:text-sky-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {formatCurrency(statsPeriodo.saldo)}
              </p>
            </div>
          </div>

          {/* Por Método de Pago */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="metodos-pago" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <h3 className="text-sm font-semibold">Ver desglose por Método de Pago</h3>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                  {statsPeriodo.porMetodo.map((stat) => (
                    <div
                      key={stat.metodo}
                      className="p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <p className="text-xs text-muted-foreground">
                        {metodoPagoLabels[stat.metodo] || stat.metodo}
                      </p>
                      <p className="text-lg font-bold">{formatCurrency(stat.total)}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Totales Históricos (Colapsable) */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="historico" className="border rounded-lg px-4 bg-card shadow-soft">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Ver Totales Históricos</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-3 pt-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Total Entradas</p>
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(totales.entradas)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Desde el inicio</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Total Salidas</p>
                  <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                </div>
                <p className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totales.salidas)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Desde el inicio</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Saldo Total</p>
                </div>
                <p className={`text-2xl font-bold ${
                  totales.saldo >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {formatCurrency(totales.saldo)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Balance general</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Listado de Movimientos con Filtros Avanzados */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Movimientos Recientes</CardTitle>
            </div>
            <Badge variant="outline">{movimientosFiltrados.length} movimientos</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros mejorados */}
          <div className="grid gap-3 md:grid-cols-4 p-4 rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Por Fecha</Label>
              <Select value={fechaFiltro} onValueChange={(value: any) => setFechaFiltro(value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hoy">Hoy</SelectItem>
                  <SelectItem value="semana">Última Semana</SelectItem>
                  <SelectItem value="mes">Último Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Por Tipo</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="salida">Salidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Por Método</Label>
              <Select value={metodoFiltro} onValueChange={setMetodoFiltro}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta Débito</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setFechaFiltro("todos");
                  setTipoFiltro("todos");
                  setMetodoFiltro("todos");
                }}
                className="w-full h-9"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* Tabla de movimientos */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Monto</TableHead>
                    <TableHead className="font-semibold">Método</TableHead>
                    <TableHead className="font-semibold">Concepto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-12"
                      >
                        No hay movimientos que coincidan con los filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimientosFiltrados.slice(0, 100).map((mov) => (
                      <TableRow key={mov.id_movimiento} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">
                          {format(new Date(mov.fecha), "dd/MM/yyyy HH:mm", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={mov.tipo === "entrada" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {mov.tipo === "entrada" ? "Entrada" : "Salida"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`font-bold ${
                            mov.tipo === "entrada" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {mov.tipo === "entrada" ? "+" : "-"} {formatCurrency(mov.monto)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {metodoPagoLabels[mov.metodo_pago || "sin_especificar"] || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                          {mov.concepto || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {movimientosFiltrados.length > 100 && (
            <p className="text-sm text-muted-foreground text-center">
              Mostrando los primeros 100 movimientos. Usa los filtros para refinar la búsqueda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CajaTab;
