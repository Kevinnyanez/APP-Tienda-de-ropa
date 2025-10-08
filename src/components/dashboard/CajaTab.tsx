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
import { ArrowDownCircle, ArrowUpCircle, ShoppingCart, ShoppingBag, Wallet } from "lucide-react";
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

    // Registrar en caja
    await supabase.from("movimientos_caja").insert({
      tipo: "entrada",
      monto: total,
      medio_pago: metodoPagoVenta,
      descripcion: `Venta - ${articulosVenta.length} artículo(s)`,
      id_venta: venta.id_venta,
      user_id: user.id,
    });

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

  const movimientosFiltrados =
    metodoFiltro === "todos"
      ? movimientos
      : movimientos.filter((m) => m.metodo_pago === metodoFiltro);

  return (
    <div className="space-y-6">
      {/* Botones de Acción Rápida */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button
          onClick={() => setDialogVenta(true)}
          className="h-24 text-xl font-bold bg-green-600 hover:bg-green-700"
          size="lg"
        >
          <ShoppingCart className="mr-3 h-8 w-8" />
          Registrar Venta
        </Button>
        <Button
          onClick={() => setDialogCompra(true)}
          className="h-24 text-xl font-bold bg-orange-600 hover:bg-orange-700"
          size="lg"
        >
          <ShoppingBag className="mr-3 h-8 w-8" />
          Registrar Compra
        </Button>
        <Button
          onClick={() => setDialogRetiro(true)}
          className="h-24 text-xl font-bold bg-red-600 hover:bg-red-700"
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
              <ShoppingCart className="h-6 w-6 text-green-600" />
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
                          className="text-red-600"
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
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
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
              <ShoppingBag className="h-6 w-6 text-orange-600" />
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
              className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700"
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
              <Wallet className="h-6 w-6 text-red-600" />
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
              className="w-full h-12 text-lg bg-red-600 hover:bg-red-700"
            >
              Confirmar Retiro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dashboard Principal */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft hover:shadow-elegant transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totales.entradas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elegant transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Salidas</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(totales.salidas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elegant transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                totales.saldo >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(totales.saldo)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Balance general</p>
          </CardContent>
        </Card>
      </div>

      {/* Selector de Período */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Resumen por Período</CardTitle>
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
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Entradas
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(statsPeriodo.entradas)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Salidas
              </p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {formatCurrency(statsPeriodo.salidas)}
              </p>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                statsPeriodo.saldo >= 0
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                  : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  statsPeriodo.saldo >= 0
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-orange-900 dark:text-orange-100"
                }`}
              >
                Saldo
              </p>
              <p
                className={`text-2xl font-bold ${
                  statsPeriodo.saldo >= 0
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-orange-700 dark:text-orange-400"
                }`}
              >
                {formatCurrency(statsPeriodo.saldo)}
              </p>
            </div>
          </div>

          {/* Por Método de Pago */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Por Método de Pago</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </CardContent>
      </Card>

      {/* Filtros y Listado de Movimientos */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Movimientos</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="metodo-filtro" className="text-sm">Filtrar:</Label>
              <select
                id="metodo-filtro"
                value={metodoFiltro}
                onChange={(e) => setMetodoFiltro(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="todos">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta_debito">Tarjeta Débito</option>
                <option value="tarjeta_credito">Tarjeta Crédito</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">MercadoPago</option>
                <option value="cuenta_corriente">Cuenta Corriente</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="font-semibold">Monto</TableHead>
                  <TableHead className="font-semibold">Método de Pago</TableHead>
                  <TableHead className="font-semibold">Concepto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No hay movimientos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientosFiltrados.slice(0, 50).map((mov) => (
                    <TableRow key={mov.id_movimiento} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {format(new Date(mov.fecha), "dd/MM/yyyy HH:mm", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={mov.tipo === "entrada" ? "default" : "destructive"}
                        >
                          {mov.tipo === "entrada" ? "Entrada" : "Salida"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`font-bold text-base ${
                          mov.tipo === "entrada" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {mov.tipo === "entrada" ? "+" : "-"} {formatCurrency(mov.monto)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {metodoPagoLabels[mov.metodo_pago || "sin_especificar"] || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mov.concepto || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CajaTab;
