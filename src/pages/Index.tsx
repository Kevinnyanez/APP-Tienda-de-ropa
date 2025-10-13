import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, ArrowRight, Users, Package, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center space-y-8 max-w-4xl mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-elegant">
            <Store className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              Administracion Las Marinas
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Sistema completo de gestión para tu tienda de ropa. Controla inventario, ventas, clientes y flujo de caja en un solo lugar.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="shadow-soft">
              Comenzar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12">
            <div className="p-6 rounded-xl bg-card border shadow-soft hover:shadow-elegant transition-all">
              <Users className="w-10 h-10 mb-4 text-accent" />
              <h3 className="text-lg font-semibold mb-2">Gestión de Clientes</h3>
              <p className="text-sm text-muted-foreground">
                Mantén un registro completo de tus clientes y su historial de compras
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border shadow-soft hover:shadow-elegant transition-all">
              <Package className="w-10 h-10 mb-4 text-accent" />
              <h3 className="text-lg font-semibold mb-2">Control de Inventario</h3>
              <p className="text-sm text-muted-foreground">
                Administra tu stock con precisión y evita quedarte sin productos
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border shadow-soft hover:shadow-elegant transition-all">
              <TrendingUp className="w-10 h-10 mb-4 text-accent" />
              <h3 className="text-lg font-semibold mb-2">Análisis de Ventas</h3>
              <p className="text-sm text-muted-foreground">
                Visualiza tus ventas y toma decisiones basadas en datos reales
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
