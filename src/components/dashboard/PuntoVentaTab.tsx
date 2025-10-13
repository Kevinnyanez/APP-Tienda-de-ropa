import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { Separator } from "@/components/ui/separator";

interface Articulo {
  id_articulo: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  stock_disponible: number;
  categoria: string;
}

interface ItemCarrito {
  id_articulo: string;
  nombre: string;
  codigo: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

interface Cliente {
  id_cliente: string;
  nombre: string;
  apellido: string;
}

const PuntoVentaTab = () => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("sin_cliente");
  const [metodoPago, setMetodoPago] = useState<string>("");
  const [openArticuloPopover, setOpenArticuloPopover] = useState(false);
  const [busquedaArticulo, setBusquedaArticulo] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    fetchArticulos();
    fetchClientes();
  }, []);

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

  const agregarAlCarrito = (articulo: Articulo) => {
    const itemExistente = carrito.find(item => item.id_articulo === articulo.id_articulo);
    
    if (itemExistente) {
      if (itemExistente.cantidad >= articulo.stock_disponible) {
        toast.error(`Stock máximo: ${articulo.stock_disponible}`);
        return;
      }
      modificarCantidad(articulo.id_articulo, itemExistente.cantidad + 1);
    } else {
      const nuevoItem: ItemCarrito = {
        id_articulo: articulo.id_articulo,
        nombre: articulo.nombre,
        codigo: articulo.codigo,
        precio: articulo.precio_venta,
        cantidad: 1,
        subtotal: articulo.precio_venta,
      };
      setCarrito([...carrito, nuevoItem]);
      toast.success(`${articulo.nombre} agregado`);
    }
    setBusquedaArticulo("");
  };

  const modificarCantidad = (id_articulo: string, nuevaCantidad: number) => {
    const articulo = articulos.find(a => a.id_articulo === id_articulo);
    
    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(id_articulo);
      return;
    }
    
    if (articulo && nuevaCantidad > articulo.stock_disponible) {
      toast.error(`Stock máximo: ${articulo.stock_disponible}`);
      return;
    }

    setCarrito(carrito.map(item => 
      item.id_articulo === id_articulo
        ? { ...item, cantidad: nuevaCantidad, subtotal: item.precio * nuevaCantidad }
        : item
    ));
  };

  const eliminarDelCarrito = (id_articulo: string) => {
    setCarrito(carrito.filter(item => item.id_articulo !== id_articulo));
  };

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + item.subtotal, 0);
  };

  const limpiarCarrito = () => {
    setCarrito([]);
    setClienteSeleccionado("sin_cliente");
    setMetodoPago("");
    setBusquedaArticulo("");
  };

  const confirmarVenta = async () => {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    if (!metodoPago) {
      toast.error("Selecciona un método de pago");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const total = calcularTotal();

    // Crear la venta
    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        id_cliente: clienteSeleccionado === "sin_cliente" ? null : clienteSeleccionado,
        total,
        estado: "pago",
        metodo_pago: metodoPago,
        user_id: user.id,
      })
      .select()
      .single();

    if (ventaError || !venta) {
      toast.error("Error al crear la venta");
      return;
    }

    // Crear los detalles de venta
    const detalles = carrito.map(item => ({
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

    toast.success("¡Venta registrada exitosamente!");
    
    // Limpiar todo
    limpiarCarrito();
    setShowConfirmDialog(false);
    fetchArticulos(); // Actualizar stock
  };

  const articulosFiltrados = articulos.filter(art =>
    art.nombre.toLowerCase().includes(busquedaArticulo.toLowerCase()) ||
    art.codigo.toLowerCase().includes(busquedaArticulo.toLowerCase())
  );

  const metodoPagoIconos: Record<string, React.ReactNode> = {
    efectivo: <Banknote className="h-5 w-5" />,
    tarjeta_debito: <CreditCard className="h-5 w-5" />,
    tarjeta_credito: <CreditCard className="h-5 w-5" />,
    transferencia: <Smartphone className="h-5 w-5" />,
    mercadopago: <Smartphone className="h-5 w-5" />,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Panel Izquierdo - Búsqueda y Productos */}
      <div className="lg:col-span-2 space-y-4">
        {/* Búsqueda rápida */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar por código o nombre..."
              value={busquedaArticulo}
              onChange={(e) => setBusquedaArticulo(e.target.value)}
              className="h-12 text-lg"
              autoFocus
            />
          </CardContent>
        </Card>

        {/* Lista de productos */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Productos Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-2">
              {articulosFiltrados.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {busquedaArticulo ? "No se encontraron productos" : "No hay productos disponibles"}
                </p>
              ) : (
                articulosFiltrados.slice(0, 20).map((articulo) => (
                  <div
                    key={articulo.id_articulo}
                    onClick={() => agregarAlCarrito(articulo)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{articulo.nombre}</p>
                        {articulo.categoria && (
                          <Badge variant="outline" className="text-xs">
                            {articulo.categoria}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {articulo.codigo} • Stock: {articulo.stock_disponible}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(articulo.precio_venta)}
                      </p>
                      <Button size="sm" variant="outline" className="mt-1">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel Derecho - Carrito y Checkout */}
      <div className="space-y-4">
        {/* Cliente */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={clienteSeleccionado} onValueChange={setClienteSeleccionado}>
              <SelectTrigger className="h-10">
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
          </CardContent>
        </Card>

        {/* Carrito */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito ({carrito.length})
              </CardTitle>
              {carrito.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limpiarCarrito}
                  className="text-rose-500"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {carrito.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Carrito vacío</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {carrito.map((item) => (
                  <div key={item.id_articulo} className="p-2 rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">{item.codigo}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarDelCarrito(item.id_articulo)}
                        className="h-6 w-6 p-0 text-rose-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => modificarCantidad(item.id_articulo, item.cantidad - 1)}
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.cantidad}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => modificarCantidad(item.id_articulo, item.cantidad + 1)}
                          className="h-7 w-7 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.precio)} c/u
                        </p>
                        <p className="font-bold text-emerald-600">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total y Método de Pago */}
        {carrito.length > 0 && (
          <>
            <Card className="shadow-soft border-2 border-emerald-200 dark:border-emerald-900">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="text-xl font-bold">{formatCurrency(calcularTotal())}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">TOTAL:</span>
                    <span className="text-3xl font-bold text-emerald-600">
                      {formatCurrency(calcularTotal())}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Efectivo
                      </div>
                    </SelectItem>
                    <SelectItem value="tarjeta_debito">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Tarjeta Débito
                      </div>
                    </SelectItem>
                    <SelectItem value="tarjeta_credito">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Tarjeta Crédito
                      </div>
                    </SelectItem>
                    <SelectItem value="transferencia">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Transferencia
                      </div>
                    </SelectItem>
                    <SelectItem value="mercadopago">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        MercadoPago
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!metodoPago}
              className="w-full h-14 text-lg bg-emerald-500/90 hover:bg-emerald-500"
            >
              <Receipt className="mr-2 h-5 w-5" />
              Confirmar Venta - {formatCurrency(calcularTotal())}
            </Button>
          </>
        )}
      </div>

      {/* Dialog de Confirmación */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items:</span>
                <span className="font-medium">{carrito.reduce((sum, item) => sum + item.cantidad, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="text-2xl font-bold text-emerald-600">{formatCurrency(calcularTotal())}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Método de pago:</span>
                <div className="flex items-center gap-2">
                  {metodoPagoIconos[metodoPago]}
                  <span className="font-medium capitalize">{metodoPago?.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarVenta}
                className="flex-1 bg-emerald-500/90 hover:bg-emerald-500"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PuntoVentaTab;

