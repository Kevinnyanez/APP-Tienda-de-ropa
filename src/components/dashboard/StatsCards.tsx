import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Package, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const StatsCards = () => {
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalArticulos: 0,
    ventasHoy: 0,
    stockTotal: 0,
    entradasHoy: 0,
    salidasHoy: 0,
    saldoHoy: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const hoy = new Date().toISOString().split("T")[0];
      
      const [clientes, articulos, ventas, movimientos] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }),
        supabase.from("articulos").select("stock_disponible"),
        supabase.from("ventas").select("total").gte("fecha", hoy),
        supabase.from("movimientos_caja").select("tipo, monto").gte("fecha", hoy),
      ]);

      const stockTotal = articulos.data?.reduce((acc, art) => acc + (art.stock_disponible || 0), 0) || 0;
      const ventasHoyTotal = ventas.data?.reduce((acc, venta) => acc + Number(venta.total || 0), 0) || 0;
      
      const entradasHoy = movimientos.data
        ?.filter((m) => m.tipo === "entrada")
        .reduce((acc, m) => acc + Number(m.monto || 0), 0) || 0;
      
      const salidasHoy = movimientos.data
        ?.filter((m) => m.tipo === "salida")
        .reduce((acc, m) => acc + Number(m.monto || 0), 0) || 0;

      setStats({
        totalClientes: clientes.count || 0,
        totalArticulos: articulos.data?.length || 0,
        ventasHoy: ventasHoyTotal,
        stockTotal,
        entradasHoy,
        salidasHoy,
        saldoHoy: entradasHoy - salidasHoy,
      });
    };

    fetchStats();
    
    // Actualizar cada minuto
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {/* Estadísticas Principales de Caja - Más prominentes */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-elegant hover:shadow-lg transition-all border-2 border-emerald-200 dark:border-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-emerald-50 dark:bg-emerald-950/20">
            <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              Entradas Hoy
            </CardTitle>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(stats.entradasHoy)}</div>
            <p className="text-sm text-muted-foreground mt-1">Ingresos del día</p>
          </CardContent>
        </Card>

        <Card className="shadow-elegant hover:shadow-lg transition-all border-2 border-rose-200 dark:border-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-rose-50 dark:bg-rose-950/20">
            <CardTitle className="text-base font-semibold text-rose-900 dark:text-rose-100">
              Salidas Hoy
            </CardTitle>
            <DollarSign className="h-6 w-6 text-rose-500" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-rose-600">{formatCurrency(stats.salidasHoy)}</div>
            <p className="text-sm text-muted-foreground mt-1">Gastos del día</p>
          </CardContent>
        </Card>

        <Card className={`shadow-elegant hover:shadow-lg transition-all border-2 ${
          stats.saldoHoy >= 0 
            ? 'border-sky-200 dark:border-sky-900' 
            : 'border-amber-200 dark:border-amber-900'
        }`}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-3 ${
            stats.saldoHoy >= 0
              ? 'bg-sky-50 dark:bg-sky-950/20'
              : 'bg-amber-50 dark:bg-amber-950/20'
          }`}>
            <CardTitle className={`text-base font-semibold ${
              stats.saldoHoy >= 0
                ? 'text-sky-900 dark:text-sky-100'
                : 'text-amber-900 dark:text-amber-100'
            }`}>
              Saldo del Día
            </CardTitle>
            <DollarSign className={`h-6 w-6 ${
              stats.saldoHoy >= 0 ? 'text-sky-500' : 'text-amber-500'
            }`} />
          </CardHeader>
          <CardContent className="pt-4">
            <div className={`text-3xl font-bold ${
              stats.saldoHoy >= 0 ? 'text-sky-600' : 'text-amber-600'
            }`}>
              {formatCurrency(stats.saldoHoy)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Balance diario</p>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas Secundarias - Más compactas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-soft hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats.ventasHoy)}</div>
            <p className="text-xs text-muted-foreground">Total vendido</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.stockTotal}</div>
            <p className="text-xs text-muted-foreground">Unidades disponibles</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Artículos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.totalArticulos}</div>
            <p className="text-xs text-muted-foreground">En inventario</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.totalClientes}</div>
            <p className="text-xs text-muted-foreground">Clientes activos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatsCards;
