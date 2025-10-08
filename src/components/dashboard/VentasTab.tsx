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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Venta {
  id_venta: string;
  fecha: string;
  total: number;
  metodo_pago: string;
  clientes: {
    nombre: string;
    apellido: string;
  } | null;
}

interface Cliente {
  id_cliente: string;
  nombre: string;
  apellido: string;
}

const VentasTab = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    id_cliente: "",
    total: "",
    metodo_pago: "",
    notas: "",
  });

  useEffect(() => {
    fetchVentas();
    fetchClientes();
  }, []);

  const fetchVentas = async () => {
    const { data, error } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (nombre, apellido)
      `)
      .order("fecha", { ascending: false })
      .limit(50);

    if (!error && data) {
      setVentas(data as any);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: venta, error } = await supabase
      .from("ventas" as any)
      .insert({
        id_cliente: formData.id_cliente || null,
        total: parseFloat(formData.total),
        metodo_pago: formData.metodo_pago,
        notas: formData.notas || null,
        user_id: user.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("No se pudo registrar la venta");
      return;
    }

    // Registrar movimiento de caja
    await supabase.from("movimientos_caja" as any).insert({
      tipo: "entrada",
      monto: parseFloat(formData.total),
      metodo_pago: formData.metodo_pago,
      concepto: "Venta",
      id_venta: (venta as any)?.id_venta,
      user_id: user.id,
    } as any);

    toast.success("Venta registrada exitosamente");
    setOpen(false);
    setFormData({
      id_cliente: "",
      total: "",
      metodo_pago: "",
      notas: "",
    });
    fetchVentas();
  };

  const metodoPagoLabels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta_debito: "Tarjeta Débito",
    tarjeta_credito: "Tarjeta Crédito",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Venta
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Venta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cliente">Cliente (opcional)</Label>
              <Select
                value={formData.id_cliente}
                onValueChange={(value) =>
                  setFormData({ ...formData, id_cliente: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cliente</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id_cliente} value={cliente.id_cliente}>
                      {cliente.nombre} {cliente.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                value={formData.total}
                onChange={(e) =>
                  setFormData({ ...formData, total: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="metodo_pago">Método de Pago</Label>
              <Select
                value={formData.metodo_pago}
                onValueChange={(value) =>
                  setFormData({ ...formData, metodo_pago: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta Débito</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="mercadopago">MercadoPago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notas">Notas</Label>
              <Input
                id="notas"
                value={formData.notas}
                onChange={(e) =>
                  setFormData({ ...formData, notas: e.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full">
              Registrar Venta
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Método Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No hay ventas registradas
                </TableCell>
              </TableRow>
            ) : (
              ventas.map((venta) => (
                <TableRow key={venta.id_venta}>
                  <TableCell>
                    {format(new Date(venta.fecha), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    {venta.clientes
                      ? `${venta.clientes.nombre} ${venta.clientes.apellido}`
                      : "Sin cliente"}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${venta.total.toFixed(2)}
                  </TableCell>
                  <TableCell>{metodoPagoLabels[venta.metodo_pago]}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default VentasTab;
