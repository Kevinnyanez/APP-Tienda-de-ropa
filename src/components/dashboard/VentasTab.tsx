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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroFecha, setFiltroFecha] = useState<"hoy" | "semana" | "mes" | "todas">("todas");
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const registrosPorPagina = 20;
  const [formData, setFormData] = useState({
    id_cliente: "sin_cliente",
    total: "",
    metodo_pago: "",
    notas: "",
  });

  useEffect(() => {
    fetchVentas();
    fetchClientes();
  }, [paginaActual]);

  useEffect(() => {
    // Resetear a la primera página cuando cambian los filtros
    setPaginaActual(1);
  }, [searchTerm, filtroFecha]);

  const fetchVentas = async () => {
    // Primero obtener el total de registros
    const { count } = await supabase
      .from("ventas")
      .select("*", { count: "exact", head: true });

    if (count) {
      setTotalRegistros(count);
    }

    // Luego obtener la página actual
    const desde = (paginaActual - 1) * registrosPorPagina;
    const { data, error } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (nombre, apellido)
      `)
      .order("fecha", { ascending: false })
      .range(desde, desde + registrosPorPagina - 1);

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
        id_cliente: formData.id_cliente === "sin_cliente" ? null : formData.id_cliente,
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
      id_cliente: "sin_cliente",
      total: "",
      metodo_pago: "",
      notas: "",
    });
    setPaginaActual(1); // Volver a la primera página
    fetchVentas();
  };

  const metodoPagoLabels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta_debito: "Tarjeta Débito",
    tarjeta_credito: "Tarjeta Crédito",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
  };

  // Filtrar ventas
  const ventasFiltradas = ventas.filter((venta) => {
    // Filtro por texto (cliente o monto)
    const coincideTexto = 
      searchTerm === "" ||
      venta.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.clientes?.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.total.toString().includes(searchTerm);

    // Filtro por fecha
    const fechaVenta = new Date(venta.fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    let coincideFecha = true;
    if (filtroFecha === "hoy") {
      coincideFecha = fechaVenta >= hoy;
    } else if (filtroFecha === "semana") {
      const semanaAtras = new Date(hoy);
      semanaAtras.setDate(semanaAtras.getDate() - 7);
      coincideFecha = fechaVenta >= semanaAtras;
    } else if (filtroFecha === "mes") {
      const mesAtras = new Date(hoy);
      mesAtras.setMonth(mesAtras.getMonth() - 1);
      coincideFecha = fechaVenta >= mesAtras;
    }

    return coincideTexto && coincideFecha;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Historial de Ventas</h3>
          <p className="text-sm text-muted-foreground">
            {ventasFiltradas.length} venta(s) {filtroFecha !== "todas" && `(${filtroFecha})`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 text-base bg-emerald-500/90 hover:bg-emerald-500">
              <Plus className="mr-2 h-5 w-5" />
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
                value={formData.id_cliente || "sin_cliente"}
                onValueChange={(value) =>
                  setFormData({ ...formData, id_cliente: value === "sin_cliente" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_cliente">Sin cliente</SelectItem>
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
      </div>

      {/* Filtros de búsqueda */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o monto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroFecha} onValueChange={(value: any) => setFiltroFecha(value)}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="hoy">Hoy</SelectItem>
            <SelectItem value="semana">Última semana</SelectItem>
            <SelectItem value="mes">Último mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
            {ventasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {ventas.length === 0 ? "No hay ventas registradas" : "No se encontraron ventas con esos filtros"}
                </TableCell>
              </TableRow>
            ) : (
              ventasFiltradas.map((venta) => (
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
                    {formatCurrency(venta.total)}
                  </TableCell>
                  <TableCell>{metodoPagoLabels[venta.metodo_pago]}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalRegistros > registrosPorPagina && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {Math.min((paginaActual - 1) * registrosPorPagina + 1, totalRegistros)} - {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} ventas
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPaginaActual(Math.max(1, paginaActual - 1))}
                  className={paginaActual === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.ceil(totalRegistros / registrosPorPagina) }, (_, i) => i + 1)
                .filter(pagina => {
                  // Mostrar primera página, última página, página actual y vecinas
                  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
                  return (
                    pagina === 1 ||
                    pagina === totalPaginas ||
                    (pagina >= paginaActual - 1 && pagina <= paginaActual + 1)
                  );
                })
                .map((pagina, index, array) => {
                  // Agregar elipsis si hay saltos
                  const elementos = [];
                  if (index > 0 && pagina - array[index - 1] > 1) {
                    elementos.push(
                      <PaginationItem key={`ellipsis-${pagina}`}>
                        <span className="px-2">...</span>
                      </PaginationItem>
                    );
                  }
                  elementos.push(
                    <PaginationItem key={pagina}>
                      <PaginationLink
                        onClick={() => setPaginaActual(pagina)}
                        isActive={paginaActual === pagina}
                        className="cursor-pointer"
                      >
                        {pagina}
                      </PaginationLink>
                    </PaginationItem>
                  );
                  return elementos;
                })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPaginaActual(Math.min(Math.ceil(totalRegistros / registrosPorPagina), paginaActual + 1))}
                  className={paginaActual >= Math.ceil(totalRegistros / registrosPorPagina) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default VentasTab;
