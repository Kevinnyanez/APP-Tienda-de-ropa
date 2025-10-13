import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, Users, Package, Calendar, Award, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ArticuloVendido {
  id_articulo: string;
  nombre: string;
  codigo: string;
  categoria: string;
  total_vendido: number;
  total_unidades: number;
  ultima_venta: string;
}

interface ClienteTop {
  id_cliente: string;
  nombre: string;
  apellido: string;
  total_compras: number;
  cantidad_compras: number;
  ultima_compra: string;
}

interface VentaPorDia {
  fecha: string;
  total: number;
  cantidad: number;
}

interface VentaPorCategoria {
  categoria: string;
  total: number;
  cantidad: number;
}

const ReportesTab = () => {
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "trimestre" | "año">("mes");
  const [articulosTop, setArticulosTop] = useState<ArticuloVendido[]>([]);
  const [clientesTop, setClientesTop] = useState<ClienteTop[]>([]);
  const [ventasPorDia, setVentasPorDia] = useState<VentaPorDia[]>([]);
  const [ventasPorCategoria, setVentasPorCategoria] = useState<VentaPorCategoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportes();
  }, [periodo]);

  const getFechaInicio = () => {
    const hoy = new Date();
    switch (periodo) {
      case "semana":
        return new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "mes":
        return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      case "trimestre":
        return new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
      case "año":
        return new Date(hoy.getFullYear(), 0, 1);
      default:
        return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    }
  };

  const fetchReportes = async () => {
    setLoading(true);
    const fechaInicio = getFechaInicio().toISOString();

    // Artículos más vendidos
    const { data: detallesVenta } = await supabase
      .from("detalle_venta")
      .select(`
        id_articulo,
        cantidad,
        precio_unitario,
        created_at,
        articulos!inner (
          nombre,
          codigo,
          categoria
        ),
        ventas!inner (
          fecha,
          estado
        )
      `)
      .gte("ventas.fecha", fechaInicio)
      .eq("ventas.estado", "pago");

    if (detallesVenta) {
      const articulosMap = new Map<string, ArticuloVendido>();
      
      detallesVenta.forEach((detalle: any) => {
        const idArticulo = detalle.id_articulo;
        const articulo = detalle.articulos;
        
        if (!articulosMap.has(idArticulo)) {
          articulosMap.set(idArticulo, {
            id_articulo: idArticulo,
            nombre: articulo.nombre,
            codigo: articulo.codigo,
            categoria: articulo.categoria || "Sin categoría",
            total_vendido: 0,
            total_unidades: 0,
            ultima_venta: detalle.created_at,
          });
        }
        
        const item = articulosMap.get(idArticulo)!;
        item.total_vendido += detalle.cantidad * detalle.precio_unitario;
        item.total_unidades += detalle.cantidad;
        if (new Date(detalle.created_at) > new Date(item.ultima_venta)) {
          item.ultima_venta = detalle.created_at;
        }
      });

      const articulosArray = Array.from(articulosMap.values())
        .sort((a, b) => b.total_vendido - a.total_vendido)
        .slice(0, 10);
      
      setArticulosTop(articulosArray);

      // Ventas por categoría
      const categoriasMap = new Map<string, VentaPorCategoria>();
      detallesVenta.forEach((detalle: any) => {
        const categoria = detalle.articulos?.categoria || "Sin categoría";
        if (!categoriasMap.has(categoria)) {
          categoriasMap.set(categoria, {
            categoria,
            total: 0,
            cantidad: 0,
          });
        }
        const cat = categoriasMap.get(categoria)!;
        cat.total += detalle.cantidad * detalle.precio_unitario;
        cat.cantidad += detalle.cantidad;
      });
      
      setVentasPorCategoria(
        Array.from(categoriasMap.values()).sort((a, b) => b.total - a.total)
      );
    }

    // Clientes top
    const { data: ventas } = await supabase
      .from("ventas")
      .select(`
        id_cliente,
        total,
        fecha,
        estado,
        clientes (
          nombre,
          apellido
        )
      `)
      .gte("fecha", fechaInicio)
      .eq("estado", "pago")
      .not("id_cliente", "is", null);

    if (ventas) {
      const clientesMap = new Map<string, ClienteTop>();
      
      ventas.forEach((venta: any) => {
        const idCliente = venta.id_cliente;
        
        if (!clientesMap.has(idCliente)) {
          clientesMap.set(idCliente, {
            id_cliente: idCliente,
            nombre: venta.clientes?.nombre || "Sin nombre",
            apellido: venta.clientes?.apellido || "",
            total_compras: 0,
            cantidad_compras: 0,
            ultima_compra: venta.fecha,
          });
        }
        
        const cliente = clientesMap.get(idCliente)!;
        cliente.total_compras += Number(venta.total);
        cliente.cantidad_compras += 1;
        if (new Date(venta.fecha) > new Date(cliente.ultima_compra)) {
          cliente.ultima_compra = venta.fecha;
        }
      });

      const clientesArray = Array.from(clientesMap.values())
        .sort((a, b) => b.total_compras - a.total_compras)
        .slice(0, 10);
      
      setClientesTop(clientesArray);
    }

    // Ventas por día
    const { data: ventasDia } = await supabase
      .from("ventas")
      .select("fecha, total, estado")
      .gte("fecha", fechaInicio)
      .eq("estado", "pago")
      .order("fecha", { ascending: false });

    if (ventasDia) {
      const diasMap = new Map<string, VentaPorDia>();
      
      ventasDia.forEach((venta: any) => {
        const fecha = format(new Date(venta.fecha), "yyyy-MM-dd");
        
        if (!diasMap.has(fecha)) {
          diasMap.set(fecha, {
            fecha,
            total: 0,
            cantidad: 0,
          });
        }
        
        const dia = diasMap.get(fecha)!;
        dia.total += Number(venta.total);
        dia.cantidad += 1;
      });

      const diasArray = Array.from(diasMap.values())
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 30);
      
      setVentasPorDia(diasArray);
    }

    setLoading(false);
  };

  const getPeriodoLabel = () => {
    switch (periodo) {
      case "semana": return "Última Semana";
      case "mes": return "Último Mes";
      case "trimestre": return "Último Trimestre";
      case "año": return "Último Año";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de Período */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reportes y Estadísticas</h2>
          <p className="text-muted-foreground">Análisis detallado del negocio - {getPeriodoLabel()}</p>
        </div>
        <div className="flex gap-2">
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
          <Button
            variant={periodo === "trimestre" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("trimestre")}
          >
            Trimestre
          </Button>
          <Button
            variant={periodo === "año" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("año")}
          >
            Año
          </Button>
        </div>
      </div>

      {/* Artículos más vendidos */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <CardTitle>Top 10 Artículos Más Vendidos</CardTitle>
          </div>
          <CardDescription>
            Ranking de productos con mejor desempeño en {getPeriodoLabel().toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articulosTop.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay datos de ventas en este período</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Artículo</TableHead>
                    <TableHead className="font-semibold">Categoría</TableHead>
                    <TableHead className="font-semibold text-right">Unidades</TableHead>
                    <TableHead className="font-semibold text-right">Total Vendido</TableHead>
                    <TableHead className="font-semibold">Última Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articulosTop.map((articulo, index) => (
                    <TableRow key={articulo.id_articulo} className="hover:bg-muted/30">
                      <TableCell className="font-bold">
                        <Badge variant={index < 3 ? "default" : "outline"}>
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{articulo.nombre}</p>
                          <p className="text-sm text-muted-foreground">{articulo.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{articulo.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {articulo.total_unidades}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(articulo.total_vendido)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(articulo.ultima_venta), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clientes Top */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            <CardTitle>Top 10 Clientes del Período</CardTitle>
          </div>
          <CardDescription>
            Clientes con mayor volumen de compras
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientesTop.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay datos de clientes en este período</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold text-right">Compras</TableHead>
                    <TableHead className="font-semibold text-right">Total Gastado</TableHead>
                    <TableHead className="font-semibold text-right">Promedio</TableHead>
                    <TableHead className="font-semibold">Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesTop.map((cliente, index) => (
                    <TableRow key={cliente.id_cliente} className="hover:bg-muted/30">
                      <TableCell className="font-bold">
                        <Badge variant={index < 3 ? "default" : "outline"}>
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {cliente.nombre} {cliente.apellido}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{cliente.cantidad_compras}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(cliente.total_compras)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(cliente.total_compras / cliente.cantidad_compras)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(cliente.ultima_compra), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de dos columnas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventas por Categoría */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-violet-500" />
              <CardTitle>Ventas por Categoría</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {ventasPorCategoria.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay datos</p>
            ) : (
              <div className="space-y-3">
                {ventasPorCategoria.map((cat) => (
                  <div key={cat.categoria} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <p className="font-medium">{cat.categoria}</p>
                      <p className="text-sm text-muted-foreground">{cat.cantidad} unidades</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{formatCurrency(cat.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por Día (últimos días) */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <CardTitle>Ventas Recientes por Día</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {ventasPorDia.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay datos</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ventasPorDia.slice(0, 15).map((dia) => (
                  <div key={dia.fecha} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {format(new Date(dia.fecha), "EEEE, dd MMM", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">{dia.cantidad} ventas</p>
                      </div>
                    </div>
                    <p className="font-bold text-emerald-600">{formatCurrency(dia.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportesTab;

