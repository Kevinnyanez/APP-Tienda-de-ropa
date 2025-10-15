import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";

interface ClienteDetailDialogProps {
  clienteId: string | null;
  clienteNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface Venta {
  id_venta: string;
  fecha: string;
  total: number;
  estado: string;
  metodo_pago: string | null;
  detalle_venta: DetalleVenta[];
}

interface DetalleVenta {
  id_detalle: string;
  id_articulo: string;
  cantidad: number;
  precio_unitario: number;
  estado_articulo: string;
  articulos: {
    codigo: string;
    nombre: string;
  } | null;
}

interface Articulo {
  id_articulo: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  stock_disponible: number;
}

const ClienteDetailDialog = ({
  clienteId,
  clienteNombre,
  open,
  onOpenChange,
  onUpdate,
}: ClienteDetailDialogProps) => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedArticulo, setSelectedArticulo] = useState("sin_articulo");
  const [cantidad, setCantidad] = useState("1");
  const [estadoInicial, setEstadoInicial] = useState("pendiente");
  
  const [totales, setTotales] = useState({
    pendiente: 0,
    deuda: 0,
    pagado: 0,
  });

  // Estado para el diálogo de método de pago
  const [showMetodoPagoDialog, setShowMetodoPagoDialog] = useState(false);
  const [ventaPendientePago, setVentaPendientePago] = useState<string | null>(null);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState("");
  const [openArticuloPopover, setOpenArticuloPopover] = useState(false);

  useEffect(() => {
    if (open && clienteId) {
      fetchVentas();
      fetchArticulos();
    }
  }, [open, clienteId]);

  const fetchVentas = async () => {
    if (!clienteId) return;

    const { data, error } = await supabase
      .from("ventas")
      .select(`
        *,
        detalle_venta (
          *,
          articulos (codigo, nombre)
        )
      `)
      .eq("id_cliente", clienteId)
      .order("fecha", { ascending: false });

    if (!error && data) {
      setVentas(data as any);
      calcularTotales(data as any);
    } else if (error) {
      console.error("Error al cargar ventas:", error);
      toast.error("No se pudieron cargar las ventas");
    }
  };

  const calcularTotales = (ventasData: Venta[]) => {
    const tots = {
      pendiente: 0,
      deuda: 0,
      pagado: 0,
    };

    ventasData.forEach((venta) => {
      if (venta.estado === "pendiente") tots.pendiente += venta.total;
      if (venta.estado === "deuda") tots.deuda += venta.total;
      if (venta.estado === "pago") tots.pagado += venta.total;
    });

    setTotales(tots);
  };

  const fetchArticulos = async () => {
    const { data, error } = await supabase
      .from("articulos")
      .select("*")
      .eq("activo", true)
      .gt("stock_disponible", 0)
      .order("nombre");

    if (!error && data) {
      setArticulos(data as any);
    }
  };

  const handleAddVenta = async () => {
    if (!clienteId || selectedArticulo === "sin_articulo") {
      toast.error("Selecciona un artículo");
      return;
    }

    const articulo = articulos.find((a) => a.id_articulo === selectedArticulo);
    if (!articulo) return;

    const cantidadNum = parseInt(cantidad);
    if (cantidadNum > articulo.stock_disponible) {
      toast.error("No hay suficiente stock disponible");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const totalVenta = cantidadNum * articulo.precio_venta;

    // Crear la venta
    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        id_cliente: clienteId,
        total: totalVenta,
        estado: estadoInicial,
        metodo_pago: estadoInicial === "pago" ? "efectivo" : "cuenta_corriente",
        notas: `${cantidadNum}x ${articulo.nombre}`,
        user_id: user.id,
      })
      .select()
      .single();

    if (ventaError || !venta) {
      toast.error("No se pudo crear la venta");
      return;
    }

    // Crear el detalle de venta
    const { error: detalleError } = await supabase
      .from("detalle_venta")
      .insert({
        id_venta: venta.id_venta,
        id_articulo: selectedArticulo,
        cantidad: cantidadNum,
        precio_unitario: articulo.precio_venta,
        estado_articulo: estadoInicial,
        user_id: user.id,
      });

    if (detalleError) {
      toast.error("Error al agregar el artículo");
      return;
    }

    // ⚠️ NO registrar manualmente en caja - el trigger de la BD lo hace automáticamente
    // cuando se inserta un detalle_venta con estado 'pago'
    
    if (estadoInicial === "pago") {
      toast.success("Prenda agregada y pagada - Registrado en caja");
    } else {
      toast.success("Prenda agregada exitosamente");
    }
    setShowAddForm(false);
    setSelectedArticulo("sin_articulo");
    setCantidad("1");
    setEstadoInicial("pendiente");
    fetchVentas();
    fetchArticulos();
    onUpdate();
  };

  const handleUpdateEstadoVenta = async (ventaId: string, nuevoEstado: string) => {
    const venta = ventas.find((v) => v.id_venta === ventaId);
    if (!venta) return;

    const estadoAnterior = venta.estado;

    // Si cambia a pago, pedir método de pago primero
    if (nuevoEstado === "pago" && estadoAnterior !== "pago") {
      setVentaPendientePago(ventaId);
      setShowMetodoPagoDialog(true);
      return;
    }

    // Para otros cambios de estado, proceder normalmente
    await actualizarEstadoVenta(ventaId, nuevoEstado, null);
  };

  const actualizarEstadoVenta = async (ventaId: string, nuevoEstado: string, metodoPago: string | null) => {
    const venta = ventas.find((v) => v.id_venta === ventaId);
    if (!venta) return;

    const estadoAnterior = venta.estado;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Actualizar el estado de la venta
    const updateData: any = { estado: nuevoEstado };
    if (metodoPago) {
      updateData.metodo_pago = metodoPago;
    }

    const { error: ventaError } = await supabase
      .from("ventas")
      .update(updateData)
      .eq("id_venta", ventaId);

    if (ventaError) {
      toast.error("No se pudo actualizar el estado");
      return;
    }

    // Actualizar todos los detalles de la venta al mismo estado
    const { error: detalleError } = await supabase
      .from("detalle_venta")
      .update({ estado_articulo: nuevoEstado })
      .eq("id_venta", ventaId);

    if (detalleError) {
      toast.error("Error al actualizar detalles");
      return;
    }

    // ⚠️ NO registrar manualmente en caja - el trigger de la BD lo hace automáticamente
    // cuando se actualiza un detalle_venta a estado 'pago'
    
    if (nuevoEstado === "pago" && estadoAnterior !== "pago") {
      toast.success("Pago registrado en caja");
    } else if (nuevoEstado === "cancelado") {
      toast.info("Venta cancelada - Stock recuperado");
    } else {
      toast.success("Estado actualizado");
    }

    fetchVentas();
    fetchArticulos();
    onUpdate();
  };

  const confirmarPagoConMetodo = async () => {
    if (!metodoPagoSeleccionado) {
      toast.error("Selecciona un método de pago");
      return;
    }

    if (!ventaPendientePago) return;

    await actualizarEstadoVenta(ventaPendientePago, "pago", metodoPagoSeleccionado);
    
    setShowMetodoPagoDialog(false);
    setVentaPendientePago(null);
    setMetodoPagoSeleccionado("");
  };

  const handleDeleteVenta = async (ventaId: string) => {
    const venta = ventas.find((v) => v.id_venta === ventaId);
    if (!venta) return;

    // Determinar el comportamiento según el estado de la venta
    if (venta.estado === "pago") {
      // Si ya está pagado, solo confirmamos que quiere eliminar el historial
      // NO se recupera stock ni se elimina el dinero de caja
      if (!confirm("¿Eliminar este registro del historial?\n\nNOTA: El pago ya fue registrado en caja y NO se eliminará. Solo se borrará este registro visual del historial del cliente.")) {
        return;
      }

      // Simplemente eliminamos el registro de la venta
      // El dinero ya está en caja y se queda ahí
      const { error } = await supabase
        .from("ventas")
        .delete()
        .eq("id_venta", ventaId);

      if (error) {
        toast.error("No se pudo eliminar el registro");
      } else {
        toast.success("Registro eliminado del historial (el pago permanece en caja)");
        fetchVentas();
        onUpdate();
      }
    } else {
      // Para estados "pendiente", "deuda" o "cancelado"
      // SÍ se recupera el stock porque no hubo transacción real
      const estadoTexto = venta.estado === "pendiente" ? "en prueba" : 
                          venta.estado === "deuda" ? "en deuda" : "cancelada";
      
      if (!confirm(`¿Eliminar esta venta ${estadoTexto}?\n\nSe recuperará el stock de los artículos.`)) {
        return;
      }

      // Los detalles se eliminan automáticamente por CASCADE
      // El trigger recuperará el stock automáticamente
      const { error } = await supabase
        .from("ventas")
        .delete()
        .eq("id_venta", ventaId);

      if (error) {
        toast.error("No se pudo eliminar la venta");
      } else {
        toast.success("Venta eliminada - Stock recuperado");
        fetchVentas();
        fetchArticulos();
        onUpdate();
      }
    }
  };

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { icon: any; className: string; label: string }> = {
      pendiente: { 
        icon: Clock, 
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        label: "Se está probando" 
      },
      pago: { 
        icon: CheckCircle, 
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
        label: "Pagado" 
      },
      deuda: { 
        icon: AlertCircle, 
        className: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
        label: "Debe" 
      },
      cancelado: { 
        icon: XCircle, 
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        label: "Cancelado" 
      },
    };
    
    const item = config[estado] || config.pendiente;
    const Icon = item.icon;
    
    return (
      <Badge className={item.className}>
        <Icon className="w-3 h-3 mr-1" />
        {item.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Cuenta Corriente - {clienteNombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tarjetas de Totales */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  Probándose
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(totales.pendiente)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">En prueba</p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 dark:border-rose-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  Debe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totales.deuda)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pendiente de pago</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 dark:border-emerald-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Pagado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(totales.pagado)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
              </CardContent>
            </Card>
          </div>

          {/* Formulario Agregar Prenda */}
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} className="w-full h-14 text-lg bg-primary">
              <Plus className="mr-2 h-5 w-5" />
              Agregar Prenda al Cliente
            </Button>
          ) : (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Nueva Prenda para {clienteNombre}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base">Artículo *</Label>
                    <Popover open={openArticuloPopover} onOpenChange={setOpenArticuloPopover}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-12"
                        >
                          {selectedArticulo !== "sin_articulo"
                            ? articulos.find((art) => art.id_articulo === selectedArticulo)?.nombre
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
                                    setSelectedArticulo(art.id_articulo);
                                    setOpenArticuloPopover(false);
                                  }}
                                >
                                  <div className="flex justify-between w-full">
                                    <span>
                                      {art.codigo} - {art.nombre}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(art.precio_venta)} | Stock: {art.stock_disponible}
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
                  <div className="space-y-2">
                    <Label className="text-base">Cantidad *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Estado Inicial *</Label>
                  <Select value={estadoInicial} onValueChange={setEstadoInicial}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente (Se está probando)</SelectItem>
                      <SelectItem value="pago">Pago (Compra y paga ahora)</SelectItem>
                      <SelectItem value="deuda">Deuda (Se lleva pero debe)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddVenta} className="flex-1 h-12">
                    Agregar Prenda
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setSelectedArticulo("sin_articulo");
                      setCantidad("1");
                    }}
                    className="flex-1 h-12"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Listado de Ventas */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Prendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Artículos</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay prendas registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      ventas.map((venta) => (
                        <TableRow key={venta.id_venta}>
                          <TableCell className="font-medium">
                            {format(new Date(venta.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            {venta.detalle_venta.map((detalle, idx) => (
                              <div key={idx} className="text-sm">
                                {detalle.cantidad}x {detalle.articulos?.nombre || "Artículo"}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="font-bold text-lg">
                            {formatCurrency(venta.total)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={venta.estado}
                              onValueChange={(value) => handleUpdateEstadoVenta(venta.id_venta, value)}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue>{getEstadoBadge(venta.estado)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendiente">Se está probando</SelectItem>
                                <SelectItem value="pago">Pagado</SelectItem>
                                <SelectItem value="deuda">Debe</SelectItem>
                                <SelectItem value="cancelado">Cancelar/Devolver</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVenta(venta.id_venta)}
                              className="text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </DialogContent>

      {/* Diálogo para seleccionar método de pago */}
      <Dialog open={showMetodoPagoDialog} onOpenChange={setShowMetodoPagoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Método de Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              ¿Cómo pagó el cliente?
            </p>
            <Select value={metodoPagoSeleccionado} onValueChange={setMetodoPagoSeleccionado}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecciona método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                <SelectItem value="tarjeta_debito">💳 Tarjeta Débito</SelectItem>
                <SelectItem value="tarjeta_credito">💳 Tarjeta Crédito</SelectItem>
                <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                <SelectItem value="mercadopago">📱 MercadoPago</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={confirmarPagoConMetodo}
                className="flex-1 h-12 bg-emerald-500/90 hover:bg-emerald-500"
              >
                Confirmar Pago
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMetodoPagoDialog(false);
                  setVentaPendientePago(null);
                  setMetodoPagoSeleccionado("");
                }}
                className="flex-1 h-12"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default ClienteDetailDialog;
