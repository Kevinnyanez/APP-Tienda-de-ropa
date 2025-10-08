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
    talle: string | null;
    color: string | null;
  } | null;
}

interface Articulo {
  id_articulo: string;
  codigo: string;
  nombre: string;
  talle: string | null;
  color: string | null;
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
          articulos (codigo, nombre, talle, color)
        )
      `)
      .eq("id_cliente", clienteId)
      .order("fecha", { ascending: false });

    if (!error && data) {
      setVentas(data as any);
      calcularTotales(data as any);
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

    // Si es pago inmediato, registrar en caja
    if (estadoInicial === "pago") {
      await supabase.from("movimientos_caja").insert({
        tipo: "entrada",
        monto: totalVenta,
        metodo_pago: "efectivo",
        concepto: `Venta a ${clienteNombre}`,
        id_venta: venta.id_venta,
        user_id: user.id,
      });
    }

    toast.success("Prenda agregada exitosamente");
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Actualizar el estado de la venta
    const { error: ventaError } = await supabase
      .from("ventas")
      .update({ estado: nuevoEstado })
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

    // Si cambia a pago y antes no era pago, registrar entrada en caja
    if (nuevoEstado === "pago" && estadoAnterior !== "pago") {
      await supabase.from("movimientos_caja").insert({
        tipo: "entrada",
        monto: venta.total,
        metodo_pago: "efectivo",
        concepto: `Pago de ${clienteNombre}`,
        id_venta: ventaId,
        user_id: user.id,
      });
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

  const handleDeleteVenta = async (ventaId: string) => {
    if (!confirm("¿Eliminar esta venta? Se recuperará el stock.")) return;

    // Los detalles se eliminan automáticamente por CASCADE
    // El trigger recuperará el stock
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
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        label: "Pagado" 
      },
      deuda: { 
        icon: AlertCircle, 
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
                  ${totales.pendiente.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">En prueba</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Debe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${totales.deuda.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pendiente de pago</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Pagado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${totales.pagado.toFixed(2)}
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
                    <Select value={selectedArticulo} onValueChange={setSelectedArticulo}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Seleccionar artículo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin_articulo">Seleccionar...</SelectItem>
                        {articulos.map((art) => (
                          <SelectItem key={art.id_articulo} value={art.id_articulo}>
                            {art.codigo} - {art.nombre} 
                            {art.talle && ` (${art.talle})`}
                            {art.color && ` - ${art.color}`}
                            {` - $${art.precio_venta.toFixed(2)} - Stock: ${art.stock_disponible}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                                {detalle.cantidad}x {detalle.articulos?.nombre}
                                {detalle.articulos?.talle && ` (${detalle.articulos.talle})`}
                                {detalle.articulos?.color && ` - ${detalle.articulos.color}`}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="font-bold text-lg">
                            ${venta.total.toFixed(2)}
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
                              className="text-red-600 hover:text-red-700"
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
    </Dialog>
  );
};

export default ClienteDetailDialog;
