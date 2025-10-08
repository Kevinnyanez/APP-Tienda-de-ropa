import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, Package, ShoppingCart, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import ClientesTab from "@/components/dashboard/ClientesTab";
import ArticulosTab from "@/components/dashboard/ArticulosTab";
import VentasTab from "@/components/dashboard/VentasTab";
import CajaTab from "@/components/dashboard/CajaTab";
import StatsCards from "@/components/dashboard/StatsCards";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Sesión cerrada correctamente");
      navigate("/auth");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Boutique Manager</h1>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <StatsCards />

        <Card className="mt-8 shadow-elegant">
          <CardHeader>
            <CardTitle>Gestión de Tienda</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="clientes" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="clientes">
                  <Users className="mr-2 h-4 w-4" />
                  Clientes
                </TabsTrigger>
                <TabsTrigger value="articulos">
                  <Package className="mr-2 h-4 w-4" />
                  Artículos
                </TabsTrigger>
                <TabsTrigger value="ventas">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Ventas
                </TabsTrigger>
                <TabsTrigger value="caja">
                  <Wallet className="mr-2 h-4 w-4" />
                  Caja
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clientes" className="mt-6">
                <ClientesTab />
              </TabsContent>

              <TabsContent value="articulos" className="mt-6">
                <ArticulosTab />
              </TabsContent>

              <TabsContent value="ventas" className="mt-6">
                <VentasTab />
              </TabsContent>

              <TabsContent value="caja" className="mt-6">
                <CajaTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
