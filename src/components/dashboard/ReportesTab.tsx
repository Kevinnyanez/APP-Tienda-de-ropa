import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface EstadisticasVentas {
  totalVentas: number;
  cantidadVentas: number;
  costoTotal: number;
  gananciaReal: number;
  margenGanancia: number;
}

interface EstadisticasCaja {
  entradas: number;
  salidas: number;
  saldo: number;
  porMetodo: { metodo: string; total: number }[];
}

interface EstadisticasDeudas {
  totalPendiente: number;
  totalDeuda: number;
  itemsPendientes: number;
  itemsDeuda: number;
}

const ReportesTab = () => {
  const [periodo, setPeriodo] = useState<"hoy" | "semana" | "mes">("hoy");
  const [loading, setLoading] = useState(true);
  
  const [statsVentas, setStatsVentas] = useState<EstadisticasVentas>({
    totalVentas: 0,
    cantidadVentas: 0,
    costoTotal: 0,
    gananciaReal: 0,
    margenGanancia: 0,
  });

  const [statsCaja, setStatsCaja] = useState<EstadisticasCaja>({
    entradas: 0,
    salidas: 0,
    saldo: 0,
    porMetodo: [],
  });

  const [statsDeudas, setStatsDeudas] = useState<EstadisticasDeudas>({
    totalPendiente: 0,
    totalDeuda: 0,
    itemsPendientes: 0,
    itemsDeuda: 0,
  });

  const [topArticulos, setTopArticulos] = useState<any[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);

  useEffect(() => {
    fetchEstadisticas();
  }, [periodo]);

  const getFechaInicio = () => {
    const hoy = new Date();
    switch (periodo) {
      case "hoy":
        return startOfDay(hoy);
      case "semana":
        return startOfWeek(hoy, { weekStartsOn: 1 });
      case "mes":
        return startOfMonth(hoy);
    }
  };

  const fetchEstadisticas = async () => {
    setLoading(true);
    const fechaInicio = getFechaInicio();
    const fechaFin = endOfDay(new Date());

    // 1. Estadísticas de Ventas con Ganancias Reales
    const { data: detallesVenta } = await supabase
      .from("detalle_venta")
      .select(`
        cantidad,
        precio_unitario,
        estado_articulo,
        articulos!inner (
          precio_costo,
          nombre,
          codigo,
          categoria
        ),
        ventas!inner (
          fecha,
          estado
        )
      `)
      .gte("ventas.fecha", fechaInicio.toISOString())
      .lte("ventas.fecha", fechaFin.toISOString())
      .eq("estado_articulo", "pago");

    if (detallesVenta) {
      let totalVentas = 0;
      let costoTotal = 0;
      let cantidadVentas = 0;

      // Calcular top artículos
      const articulosMap = new Map();
      
      detallesVenta.forEach((detalle: any) => {
        const subtotal = detalle.cantidad * detalle.precio_unitario;
        const subtotalCosto = detalle.cantidad * detalle.articulos.precio_costo;
        
        totalVentas += subtotal;
        costoTotal += subtotalCosto;
        cantidadVentas += detalle.cantidad;

        // Top artículos
        const key = detalle.articulos.codigo;
        if (!articulosMap.has(key)) {
          articulosMap.set(key, {
            nombre: detalle.articulos.nombre,
            codigo: detalle.articulos.codigo,
            unidades: 0,
            total: 0,
            ganancia: 0,
          });
        }
        const art = articulosMap.get(key);
        art.unidades += detalle.cantidad;
        art.total += subtotal;
        art.ganancia += (subtotal - subtotalCosto);
      });

      const gananciaReal = totalVentas - costoTotal;
      const margenGanancia = totalVentas > 0 ? (gananciaReal / totalVentas) * 100 : 0;

      setStatsVentas({
        totalVentas,
        cantidadVentas,
        costoTotal,
        gananciaReal,
        margenGanancia,
      });

      // Top 5 artículos
      const topArts = Array.from(articulosMap.values())
        .sort((a, b) => b.ganancia - a.ganancia)
        .slice(0, 5);
      setTopArticulos(topArts);
    }

    // 2. Estadísticas de Caja
    const { data: movimientos, error: errorMovimientos } = await supabase
      .from("movimientos_caja")
      .select("*")
      .gte("fecha", fechaInicio.toISOString())
      .lte("fecha", fechaFin.toISOString());
    
    if (errorMovimientos) {
      console.error("Error al cargar movimientos:", errorMovimientos);
    }

    if (movimientos && movimientos.length > 0) {
      let entradas = 0;
      let salidas = 0;
      const metodosMap = new Map<string, number>();

      movimientos.forEach((mov: any) => {
        const monto = Number(mov.monto);
        
        if (mov.tipo === "entrada") {
          entradas += monto;
          const metodo = mov.metodo_pago || mov.medio_pago || "sin_especificar";
          metodosMap.set(metodo, (metodosMap.get(metodo) || 0) + monto);
        } else if (mov.tipo === "salida") {
          salidas += monto;
        }
      });

      setStatsCaja({
        entradas,
        salidas,
        saldo: entradas - salidas,
        porMetodo: Array.from(metodosMap.entries()).map(([metodo, total]) => ({
          metodo,
          total,
        })),
      });
    } else {
      // Si no hay movimientos, asegurar que los valores sean 0
      setStatsCaja({
        entradas: 0,
        salidas: 0,
        saldo: 0,
        porMetodo: [],
      });
    }

    // 3. Estadísticas de Deudas (todas las deudas, no solo del período)
    const { data: deudas } = await supabase
      .from("detalle_venta")
      .select("estado_articulo, cantidad, precio_unitario")
      .in("estado_articulo", ["pendiente", "deuda"]);

    if (deudas) {
      let totalPendiente = 0;
      let totalDeuda = 0;
      let itemsPendientes = 0;
      let itemsDeuda = 0;

      deudas.forEach((detalle: any) => {
        const subtotal = detalle.cantidad * detalle.precio_unitario;
        if (detalle.estado_articulo === "pendiente") {
          totalPendiente += subtotal;
          itemsPendientes += detalle.cantidad;
        } else if (detalle.estado_articulo === "deuda") {
          totalDeuda += subtotal;
          itemsDeuda += detalle.cantidad;
        }
      });

      setStatsDeudas({
        totalPendiente,
        totalDeuda,
        itemsPendientes,
        itemsDeuda,
      });
    }

    // 4. Top Clientes
    const { data: ventas } = await supabase
      .from("ventas")
      .select(`
        id_cliente,
        total,
        estado,
        clientes (
          nombre,
          apellido
        )
      `)
      .gte("fecha", fechaInicio.toISOString())
      .lte("fecha", fechaFin.toISOString())
      .eq("estado", "pago")
      .not("id_cliente", "is", null);

    if (ventas) {
      const clientesMap = new Map();
      
      ventas.forEach((venta: any) => {
        const key = venta.id_cliente;
        if (!clientesMap.has(key)) {
          clientesMap.set(key, {
            nombre: `${venta.clientes?.nombre || ''} ${venta.clientes?.apellido || ''}`,
            total: 0,
            cantidad: 0,
          });
        }
        const cliente = clientesMap.get(key);
        cliente.total += Number(venta.total);
        cliente.cantidad += 1;
      });

      const topClis = Array.from(clientesMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopClientes(topClis);
    }

    setLoading(false);
  };

  const metodoPagoLabels: Record<string, { label: string; icon: string }> = {
    efectivo: { label: "Efectivo", icon: "💵" },
    tarjeta_debito: { label: "Tarjeta Débito", icon: "💳" },
    tarjeta_credito: { label: "Tarjeta Crédito", icon: "💳" },
    transferencia: { label: "Transferencia", icon: "🏦" },
    mercadopago: { label: "MercadoPago", icon: "📱" },
    cuenta_corriente: { label: "Cuenta Corriente", icon: "📋" },
    sin_especificar: { label: "Sin especificar", icon: "❓" },
  };

  const getPeriodoLabel = () => {
    switch (periodo) {
      case "hoy": return "Hoy";
      case "semana": return "Esta Semana";
      case "mes": return "Este Mes";
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
      {/* Header con Selector de Período */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold">Arqueo de Caja</h2>
          <p className="text-muted-foreground mt-1">Resumen financiero - {getPeriodoLabel()}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={periodo === "hoy" ? "default" : "outline"}
            onClick={() => setPeriodo("hoy")}
            className="h-11"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            Hoy
          </Button>
          <Button
            variant={periodo === "semana" ? "default" : "outline"}
            onClick={() => setPeriodo("semana")}
            className="h-11"
          >
            Esta Semana
          </Button>
          <Button
            variant={periodo === "mes" ? "default" : "outline"}
            onClick={() => setPeriodo("mes")}
            className="h-11"
          >
            Este Mes
          </Button>
        </div>
      </div>

      {/* Cards Principales - Métricas Clave */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Ventas */}
        <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Total Vendido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(statsVentas.totalVentas)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {statsVentas.cantidadVentas} artículos vendidos
            </p>
          </CardContent>
        </Card>

        {/* Ganancia Real */}
        <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-white dark:to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ganancia Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(statsVentas.gananciaReal)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Margen: {statsVentas.margenGanancia.toFixed(1)}%
              </Badge>
              <p className="text-xs text-muted-foreground">
                Costo: {formatCurrency(statsVentas.costoTotal)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Saldo de Caja */}
        <Card className={`border-2 ${statsCaja.saldo >= 0 ? 'border-sky-200 dark:border-sky-900 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-background' : 'border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo en Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${statsCaja.saldo >= 0 ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {formatCurrency(statsCaja.saldo)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-emerald-600">↑ {formatCurrency(statsCaja.entradas)}</span>
              <span className="text-rose-600">↓ {formatCurrency(statsCaja.salidas)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Deudas Pendientes */}
        <Card className="border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(statsDeudas.totalDeuda + statsDeudas.totalPendiente)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                <Clock className="h-3 w-3 mr-1" />
                {statsDeudas.itemsPendientes} probando
              </Badge>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                {statsDeudas.itemsDeuda} deben
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda Fila - Detalles de Caja y Métodos de Pago */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Resumen de Movimientos */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Movimientos de Caja
            </CardTitle>
            <CardDescription>Entradas y salidas del período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Entradas</p>
                  <p className="text-xs text-muted-foreground">Ingresos totales</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(statsCaja.entradas)}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900">
                  <ArrowDownCircle className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-rose-900 dark:text-rose-100">Salidas</p>
                  <p className="text-xs text-muted-foreground">Gastos y retiros</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-600">
                {formatCurrency(statsCaja.salidas)}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary">
              <div>
                <p className="text-sm font-semibold">Balance del Período</p>
                <p className="text-xs text-muted-foreground">
                  {statsCaja.saldo >= 0 ? "Positivo ✓" : "Negativo ⚠️"}
                </p>
              </div>
              <div className={`text-3xl font-bold ${statsCaja.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(statsCaja.saldo)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Ingresos por Método de Pago
            </CardTitle>
            <CardDescription>Desglose de entradas</CardDescription>
          </CardHeader>
          <CardContent>
            {statsCaja.porMetodo.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay ingresos en este período
              </p>
            ) : (
              <div className="space-y-3">
                {statsCaja.porMetodo
                  .sort((a, b) => b.total - a.total)
                  .map((item) => {
                    const info = metodoPagoLabels[item.metodo] || metodoPagoLabels.sin_especificar;
                    const porcentaje = (item.total / statsCaja.entradas) * 100;
                    
                    return (
                      <div key={item.metodo} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{info.icon}</span>
                            <span className="text-sm font-medium">{info.label}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">
                              {formatCurrency(item.total)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {porcentaje.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tercera Fila - Top Artículos y Clientes */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Artículos Más Rentables */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              Top Artículos Más Rentables
            </CardTitle>
            <CardDescription>Por ganancia generada</CardDescription>
          </CardHeader>
          <CardContent>
            {topArticulos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay ventas en este período
              </p>
            ) : (
              <div className="space-y-3">
                {topArticulos.map((art, index) => (
                  <div
                    key={art.codigo}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={index < 3 ? "default" : "outline"} className="text-base px-3">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{art.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {art.unidades} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">
                        +{formatCurrency(art.ganancia)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        de {formatCurrency(art.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-500" />
              Mejores Clientes
            </CardTitle>
            <CardDescription>Por monto de compras</CardDescription>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay clientes en este período
              </p>
            ) : (
              <div className="space-y-3">
                {topClientes.map((cliente, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={index < 3 ? "default" : "outline"} className="text-base px-3">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{cliente.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.cantidad} {cliente.cantidad === 1 ? 'compra' : 'compras'}
                        </p>
                      </div>
                    </div>
                    <div className="font-bold text-primary text-lg">
                      {formatCurrency(cliente.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Estado de Deudas */}
      {(statsDeudas.totalDeuda > 0 || statsDeudas.totalPendiente > 0) && (
        <Card className="border-2 border-amber-200 dark:border-amber-900 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Estado de Cuenta Corriente
            </CardTitle>
            <CardDescription>Resumen de prendas pendientes y deudas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Clientes Probándose
                  </h3>
                </div>
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {formatCurrency(statsDeudas.totalPendiente)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {statsDeudas.itemsPendientes} prendas en prueba
                </p>
              </div>

              <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                  <h3 className="font-semibold text-rose-900 dark:text-rose-100">
                    Deudas Activas
                  </h3>
                </div>
                <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {formatCurrency(statsDeudas.totalDeuda)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {statsDeudas.itemsDeuda} prendas adeudadas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportesTab;
