import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ClienteDetailDialog from "./ClienteDetailDialog";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Search, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

interface Cliente {
  id_cliente: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean | null;
  total_pendiente?: number;
  total_deuda?: number;
  items_pendientes?: number;
  items_deuda?: number;
}

const ClientesTab = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const registrosPorPagina = 20;
  const [selectedCliente, setSelectedCliente] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    direccion: "",
  });

  useEffect(() => {
    fetchClientes();
  }, [paginaActual]);

  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm]);

  const fetchClientes = async () => {
    // Obtener el total de registros
    const { count } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("activo", true);

    if (count) {
      setTotalRegistros(count);
    }

    // Obtener la página actual
    const desde = (paginaActual - 1) * registrosPorPagina;
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .range(desde, desde + registrosPorPagina - 1);

    if (error) {
      toast.error("Error al cargar clientes");
      return;
    }

    if (!data) {
      setClientes([]);
      return;
    }

    // Obtener deudas y pendientes de cada cliente
    const clientesConDeudas = await Promise.all(
      data.map(async (cliente) => {
        const { data: detalles } = await supabase
          .from("detalle_venta")
          .select("estado_articulo, cantidad, precio_unitario")
          .eq("id_cliente", cliente.id_cliente);

        let total_pendiente = 0;
        let total_deuda = 0;
        let items_pendientes = 0;
        let items_deuda = 0;

        if (detalles) {
          detalles.forEach((detalle: any) => {
            const subtotal = detalle.cantidad * detalle.precio_unitario;
            if (detalle.estado_articulo === "pendiente") {
              total_pendiente += subtotal;
              items_pendientes += detalle.cantidad;
            } else if (detalle.estado_articulo === "deuda") {
              total_deuda += subtotal;
              items_deuda += detalle.cantidad;
            }
          });
        }

        return {
          ...cliente,
          total_pendiente,
          total_deuda,
          items_pendientes,
          items_deuda,
        };
      })
    );

    setClientes(clientesConDeudas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("clientes").insert({
      nombre: formData.nombre,
      apellido: formData.apellido,
      dni: formData.dni || null,
      telefono: formData.telefono || null,
      email: formData.email || null,
      direccion: formData.direccion || null,
      user_id: user.id,
    });

    if (error) {
      toast.error("No se pudo crear el cliente");
    } else {
      toast.success("Cliente creado exitosamente");
      setOpen(false);
      setFormData({
        nombre: "",
        apellido: "",
        dni: "",
        telefono: "",
        email: "",
        direccion: "",
      });
      setPaginaActual(1);
      fetchClientes();
    }
  };

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.dni?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 text-base">
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input
                    id="apellido"
                    value={formData.apellido}
                    onChange={(e) =>
                      setFormData({ ...formData, apellido: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) =>
                    setFormData({ ...formData, dni: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                Crear Cliente
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI / Teléfono</TableHead>
              <TableHead className="text-center">Probándose</TableHead>
              <TableHead className="text-center">Debe</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay clientes registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredClientes.map((cliente) => {
                const tienePendientes = (cliente.total_pendiente || 0) > 0;
                const tieneDeuda = (cliente.total_deuda || 0) > 0;
                const tieneActividad = tienePendientes || tieneDeuda;

                return (
                  <TableRow
                    key={cliente.id_cliente}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setSelectedCliente({
                        id: cliente.id_cliente,
                        nombre: `${cliente.nombre} ${cliente.apellido}`,
                      })
                    }
                  >
                    <TableCell className="font-medium">
                      {cliente.nombre} {cliente.apellido}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cliente.dni && <div>{cliente.dni}</div>}
                      {cliente.telefono && <div>{cliente.telefono}</div>}
                      {!cliente.dni && !cliente.telefono && "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {tienePendientes ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            {cliente.items_pendientes}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(cliente.total_pendiente || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tieneDeuda ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {cliente.items_deuda}
                          </Badge>
                          <span className="text-xs font-semibold text-rose-600">
                            {formatCurrency(cliente.total_deuda || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {tieneActividad ? (
                        <Badge variant={tieneDeuda ? "destructive" : "secondary"}>
                          {tieneDeuda ? "Con deuda" : "Probándose"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Al día
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ClienteDetailDialog
        clienteId={selectedCliente?.id || null}
        clienteNombre={selectedCliente?.nombre || ""}
        open={!!selectedCliente}
        onOpenChange={(open) => !open && setSelectedCliente(null)}
        onUpdate={fetchClientes}
      />

      {/* Paginación */}
      {totalRegistros > registrosPorPagina && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {Math.min((paginaActual - 1) * registrosPorPagina + 1, totalRegistros)} - {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} clientes
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
                  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
                  return (
                    pagina === 1 ||
                    pagina === totalPaginas ||
                    (pagina >= paginaActual - 1 && pagina <= paginaActual + 1)
                  );
                })
                .map((pagina, index, array) => {
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

export default ClientesTab;
