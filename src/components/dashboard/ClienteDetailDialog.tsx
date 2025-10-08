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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface ClienteDetailDialogProps {
  clienteId: string | null;
  clienteNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface ItemCliente {
  id_item: string;
  id_articulo: string;
  cantidad: number;
  precio_unitario: number;
  estado: string;
  fecha_asignacion: string;
  articulos: {
    id_articulo: string;
    codigo: number;
    nombre: string;
    talle: string | null;
    color: string | null;
  };
}

interface Articulo {
  id_articulo: string;
  codigo: number | string;
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
  const [items, setItems] = useState<ItemCliente[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedArticulo, setSelectedArticulo] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const { toast } = useToast();

  useEffect(() => {
    if (open && clienteId) {
      fetchItems();
      fetchArticulos();
    }
  }, [open, clienteId]);

  const fetchItems = async () => {
    if (!clienteId) return;

    const { data, error } = await supabase
      .from("items_cliente" as any)
      .select(`
        *,
        articulos (id_articulo, codigo, nombre, talle, color)
      `)
      .eq("id_cliente", clienteId)
      .order("fecha_asignacion", { ascending: false });

    if (!error && data) {
      setItems(data as any);
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
      const normalized = (data as any[]).map((a) => ({
        id_articulo: a.id_articulo,
        codigo: a.codigo,
        nombre: a.nombre,
        talle: a.talle ?? null,
        color: a.color ?? null,
        precio_venta: a.precio_venta,
        stock_disponible: a.stock_disponible,
      }));
      setArticulos(normalized as any);
    }
  };

  const handleAddItem = async () => {
    if (!clienteId || !selectedArticulo) return;

    const articulo = articulos.find((a) => a.id_articulo === selectedArticulo);
    if (!articulo) return;

    const cantidadNum = parseInt(cantidad);
    if (cantidadNum > articulo.stock_disponible) {
      toast({
        title: "Error",
        description: "No hay suficiente stock disponible",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("items_cliente" as any).insert({
      id_cliente: clienteId,
      id_articulo: selectedArticulo,
      cantidad: cantidadNum,
      precio_unitario: articulo.precio_venta,
      estado: "pendiente",
      user_id: user.id,
    } as any);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el artículo",
        variant: "destructive",
      });
    } else {
      toast({ title: "Artículo agregado al cliente" });
      setShowAddForm(false);
      setSelectedArticulo("");
      setCantidad("1");
      fetchItems();
      fetchArticulos();
      onUpdate();
    }
  };

  const handleUpdateEstado = async (itemId: string, nuevoEstado: string) => {
    const item = items.find((i) => i.id_item === itemId);
    if (!item || !clienteId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const estadoAnterior = item.estado;
    const totalVenta = item.cantidad * item.precio_unitario;

    // Actualizar el estado del item
    const { error } = await supabase
      .from("items_cliente" as any)
      .update({ estado: nuevoEstado } as any)
      .eq("id_item", itemId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
      return;
    }

    // Ajustar stock según el cambio de estado
    const { error: stockError } = await supabase.rpc("ajustar_stock_por_estado", {
      p_id_articulo: item.id_articulo,
      p_estado_anterior: estadoAnterior,
      p_estado_nuevo: nuevoEstado,
    } as any);

    if (stockError) {
      toast({
        title: "Error",
        description: "Error al ajustar stock",
        variant: "destructive",
      });
      return;
    }

    // Si el estado es "vendido", registrar la venta y liberar stock reservado
    if (nuevoEstado === "vendido") {
      const { error: ventaError } = await supabase.from("ventas" as any).insert({
        id_cliente: clienteId,
        total: totalVenta,
        metodo_pago: "cuenta_corriente",
        observaciones: `Venta de ${item.cantidad}x ${item.articulos?.nombre || ""}`,
        user_id: user.id,
      } as any);

      if (ventaError) {
        toast({
          title: "Error",
          description: "Error al registrar la venta",
          variant: "destructive",
        });
        return;
      }

      // Registrar movimiento de caja
      await supabase.from("movimientos_caja" as any).insert({
        tipo: "entrada",
        monto: totalVenta,
        metodo_pago: "cuenta_corriente",
        concepto: `Venta a ${clienteNombre}`,
        user_id: user.id,
      } as any);

      toast({ 
        title: "Venta registrada", 
        description: "Stock actualizado correctamente" 
      });
    } else if (nuevoEstado === "deuda") {
      toast({ 
        title: "Estado actualizado", 
        description: "Stock reservado - deuda pendiente" 
      });
    } else if (nuevoEstado === "pendiente") {
      toast({ 
        title: "Estado actualizado", 
        description: "Stock reservado - pendiente" 
      });
    } else {
      toast({ title: "Estado actualizado" });
    }

    fetchItems();
    fetchArticulos();
    onUpdate();
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("items_cliente" as any)
      .delete()
      .eq("id_item", itemId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el artículo",
        variant: "destructive",
      });
    } else {
      toast({ title: "Artículo eliminado" });
      fetchItems();
      fetchArticulos();
      onUpdate();
    }
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pendiente: { variant: "outline", label: "Pendiente" },
      vendido: { variant: "default", label: "Vendido" },
      deuda: { variant: "destructive", label: "Deuda" },
    };
    const config = variants[estado] || variants.pendiente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const totalPendiente = items
    .filter((i) => i.estado === "pendiente")
    .reduce((sum, i) => sum + i.cantidad * i.precio_unitario, 0);

  const totalDeuda = items
    .filter((i) => i.estado === "deuda")
    .reduce((sum, i) => sum + i.cantidad * i.precio_unitario, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prendas de {clienteNombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Pendiente</div>
              <div className="text-2xl font-bold">${totalPendiente.toFixed(2)}</div>
            </div>
            <div className="flex-1 p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Deuda</div>
              <div className="text-2xl font-bold text-destructive">
                ${totalDeuda.toFixed(2)}
              </div>
            </div>
          </div>

          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Prenda
            </Button>
          ) : (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Artículo</Label>
                  <Select value={selectedArticulo} onValueChange={setSelectedArticulo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar artículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {articulos.map((art) => (
                        <SelectItem key={art.id_articulo} value={art.id_articulo}>
                          {art.codigo} - {art.nombre} {art.talle && `(${art.talle})`}{" "}
                          {art.color && `- ${art.color}`} - Stock: {art.stock_disponible}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddItem} className="flex-1">
                  Agregar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedArticulo("");
                    setCantidad("1");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Precio Unit.</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay prendas asignadas
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id_item}>
                      <TableCell className="font-mono">
                        {item.articulos.codigo}
                      </TableCell>
                      <TableCell>
                        {item.articulos.nombre}{" "}
                        {item.articulos.talle && `(${item.articulos.talle})`}
                        {item.articulos.color && ` - ${item.articulos.color}`}
                      </TableCell>
                      <TableCell>{item.cantidad}</TableCell>
                      <TableCell>${item.precio_unitario.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">
                        ${(item.cantidad * item.precio_unitario).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.estado}
                          onValueChange={(value) =>
                            handleUpdateEstado(item.id_item, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue>{getEstadoBadge(item.estado)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="pago">Pagado</SelectItem>
                            <SelectItem value="deuda">Deuda</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id_item)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteDetailDialog;
