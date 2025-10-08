import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowLeftRight,
  ShoppingBag,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface Cliente {
  id_cliente: string;
  nombre: string;
  apellido: string;
}

const PuntoVentaTab = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState("sin_cliente");
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from("clientes")
      .select("id_cliente, nombre, apellido")
      .eq("activo", true)
      .order("nombre");

    if (data) {
      setClientes(data);
    }
  };

  const registrarVenta = async (metodoPago: string) => {
    if (!total || parseFloat(total) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCargando(false);
      return;
    }

    try {
      // Registrar la venta
      const { data: venta, error: ventaError } = await supabase
        .from("ventas" as any)
        .insert({
          id_cliente: clienteSeleccionado === "sin_cliente" ? null : clienteSeleccionado,
          total: parseFloat(total),
          metodo_pago: metodoPago,
          notas: notas || null,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Registrar movimiento de caja (entrada)
      await supabase.from("movimientos_caja" as any).insert({
        tipo: "entrada",
        monto: parseFloat(total),
        metodo_pago: metodoPago,
        concepto: "Venta",
        id_venta: (venta as any)?.id_venta,
        user_id: user.id,
      } as any);

      toast.success("¡Venta registrada!", {
        description: `$${parseFloat(total).toFixed(2)} - ${getMetodoPagoLabel(metodoPago)}`,
      });

      // Limpiar formulario
      setTotal("");
      setClienteSeleccionado("sin_cliente");
      setNotas("");
    } catch (error) {
      toast.error("Error al registrar la venta");
    } finally {
      setCargando(false);
    }
  };

  const getMetodoPagoLabel = (metodo: string) => {
    const labels: Record<string, string> = {
      efectivo: "Efectivo",
      tarjeta_debito: "Débito",
      tarjeta_credito: "Crédito",
      transferencia: "Transferencia",
      mercadopago: "MercadoPago",
    };
    return labels[metodo] || metodo;
  };

  const limpiar = () => {
    setTotal("");
    setClienteSeleccionado("sin_cliente");
    setNotas("");
  };

  return (
    <div className="space-y-6">
      {/* Área principal de venta */}
      <Card className="shadow-elegant border-2">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShoppingBag className="w-7 h-7" />
            Nueva Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Monto */}
          <div className="space-y-3">
            <Label htmlFor="total" className="text-lg font-semibold">
              Monto Total
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground" />
              <Input
                id="total"
                type="number"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className="text-4xl font-bold h-20 pl-16 pr-6 text-center"
                autoFocus
              />
            </div>
          </div>

          {/* Cliente (opcional) */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Cliente (Opcional)</Label>
            <Select
              value={clienteSeleccionado || "sin_cliente"}
              onValueChange={(value) => setClienteSeleccionado(value === "sin_cliente" ? "" : value)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Sin cliente / Cliente general" />
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

          {/* Notas */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Notas (Opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalles de la venta..."
              className="h-12 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Métodos de pago - Botones grandes */}
      <Card className="shadow-elegant border-2">
        <CardHeader>
          <CardTitle className="text-xl">Seleccionar Método de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              onClick={() => registrarVenta("efectivo")}
              disabled={cargando || !total}
              className="h-32 flex flex-col gap-3 text-lg font-bold bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Banknote className="w-12 h-12" />
              Efectivo
            </Button>

            <Button
              onClick={() => registrarVenta("tarjeta_debito")}
              disabled={cargando || !total}
              className="h-32 flex flex-col gap-3 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <CreditCard className="w-12 h-12" />
              Débito
            </Button>

            <Button
              onClick={() => registrarVenta("tarjeta_credito")}
              disabled={cargando || !total}
              className="h-32 flex flex-col gap-3 text-lg font-bold bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              <CreditCard className="w-12 h-12" />
              Crédito
            </Button>

            <Button
              onClick={() => registrarVenta("transferencia")}
              disabled={cargando || !total}
              className="h-32 flex flex-col gap-3 text-lg font-bold bg-indigo-600 hover:bg-indigo-700"
              size="lg"
            >
              <ArrowLeftRight className="w-12 h-12" />
              Transferencia
            </Button>

            <Button
              onClick={() => registrarVenta("mercadopago")}
              disabled={cargando || !total}
              className="h-32 flex flex-col gap-3 text-lg font-bold bg-cyan-600 hover:bg-cyan-700"
              size="lg"
            >
              <Smartphone className="w-12 h-12" />
              MercadoPago
            </Button>

            <Button
              onClick={limpiar}
              disabled={cargando}
              variant="outline"
              className="h-32 flex flex-col gap-3 text-lg font-bold border-2"
              size="lg"
            >
              <Trash2 className="w-12 h-12" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instrucciones simples */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">¿Cómo registrar una venta?</h3>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Ingresa el monto total de la venta</li>
                <li>2. (Opcional) Selecciona el cliente</li>
                <li>3. Presiona el botón del método de pago</li>
                <li>4. ¡Listo! La venta quedará registrada</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PuntoVentaTab;

