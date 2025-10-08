import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Package, DollarSign, TrendingUp } from "lucide-react";

const StatsCards = () => {
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalArticulos: 0,
    ventasHoy: 0,
    stockTotal: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [clientes, articulos, ventas] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }),
        supabase.from("articulos").select("stock_disponible"),
        supabase.from("ventas").select("total").gte("fecha", new Date().toISOString().split("T")[0]),
      ]);

      const stockTotal = articulos.data?.reduce((acc, art) => acc + (art.stock_disponible || 0), 0) || 0;
      const ventasHoyTotal = ventas.data?.reduce((acc, venta) => acc + Number(venta.total || 0), 0) || 0;

      setStats({
        totalClientes: clientes.count || 0,
        totalArticulos: articulos.data?.length || 0,
        ventasHoy: ventasHoyTotal,
        stockTotal,
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-soft hover:shadow-elegant transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalClientes}</div>
          <p className="text-xs text-muted-foreground">Clientes activos</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-elegant transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Artículos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalArticulos}</div>
          <p className="text-xs text-muted-foreground">En inventario</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-elegant transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.ventasHoy.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Total del día</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-elegant transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.stockTotal}</div>
          <p className="text-xs text-muted-foreground">Unidades disponibles</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
