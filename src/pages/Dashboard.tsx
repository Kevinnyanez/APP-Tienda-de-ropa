import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Package, TrendingUp, DollarSign, Store, LayoutDashboard, BarChart3, ShoppingCart, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import ClientesTab from "@/components/dashboard/ClientesTab";
import ArticulosTab from "@/components/dashboard/ArticulosTab";
import VentasTab from "@/components/dashboard/VentasTab";
import PuntoVentaTab from "@/components/dashboard/PuntoVentaTab";
import CajaTab from "@/components/dashboard/CajaTab";
import ReportesTab from "@/components/dashboard/ReportesTab";
import StatsCards from "@/components/dashboard/StatsCards";
import GlobalSearch from "@/components/GlobalSearch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"dashboard" | "pos" | "caja" | "ventas" | "articulos" | "clientes" | "reportes">("dashboard");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
        setLoading(false);
      }
    );

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

  const menuItems = [
    { 
      id: "dashboard" as const, 
      label: "Inicio", 
      description: "Resumen general",
      icon: LayoutDashboard,
      color: "text-sky-600 dark:text-sky-400"
    },
    { 
      id: "pos" as const, 
      label: "Vender", 
      description: "Punto de venta",
      icon: ShoppingCart,
      color: "text-emerald-600 dark:text-emerald-400"
    },
    { 
      id: "clientes" as const, 
      label: "Clientes", 
      description: "Cuenta corriente",
      icon: Users,
      color: "text-violet-600 dark:text-violet-400"
    },
    { 
      id: "reportes" as const, 
      label: "Arqueo de Caja", 
      description: "Ver ganancias",
      icon: BarChart3,
      color: "text-amber-600 dark:text-amber-400"
    },
    { 
      id: "caja" as const, 
      label: "Movimientos", 
      description: "Ingresos y gastos",
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400"
    },
    { 
      id: "articulos" as const, 
      label: "Inventario", 
      description: "Gestionar prendas",
      icon: Package,
      color: "text-orange-600 dark:text-orange-400"
    },
    { 
      id: "ventas" as const, 
      label: "Historial", 
      description: "Ventas anteriores",
      icon: TrendingUp,
      color: "text-rose-600 dark:text-rose-400"
    },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <StatsCards />;
      case "pos":
        return <PuntoVentaTab />;
      case "caja":
        return <CajaTab />;
      case "ventas":
        return <VentasTab />;
      case "reportes":
        return <ReportesTab />;
      case "articulos":
        return <ArticulosTab />;
      case "clientes":
        return <ClientesTab />;
      default:
        return <StatsCards />;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case "dashboard":
        return "Inicio - Resumen General";
      case "pos":
        return "Punto de Venta - Realizar Ventas";
      case "caja":
        return "Movimientos de Caja - Ingresos y Gastos";
      case "ventas":
        return "Historial de Ventas";
      case "reportes":
        return "Arqueo de Caja - Ganancias y Estadísticas";
      case "articulos":
        return "Inventario - Gestión de Prendas";
      case "clientes":
        return "Clientes - Cuenta Corriente";
      default:
        return "Inicio";
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader className="border-b">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold">Las Marías</h2>
                <p className="text-xs text-muted-foreground">Administración</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveSection(item.id)}
                          isActive={isActive}
                          size="lg"
                          tooltip={item.label}
                          className={`h-16 ${isActive ? 'bg-accent/80' : ''}`}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-background shadow-sm' : 'bg-accent/50'}`}>
                              <Icon className={`w-5 h-5 shrink-0 ${isActive ? item.color : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-semibold text-sm">{item.label}</span>
                              <span className="text-xs text-muted-foreground">{item.description}</span>
                            </div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="px-2 py-2">
                  <div className="flex flex-col gap-1 mb-3">
                    <p className="text-sm font-medium truncate">{session.user.email}</p>
                    <p className="text-xs text-muted-foreground">Administrador</p>
                  </div>
                  <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </Button>
                  
                  {/* Créditos */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Desarrollado por
                      </p>
                      <img 
                        src="/1.png" 
                        alt="Appy Studios" 
                        className="h-7 object-contain"
                      />
                    </div>
                  </div>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset>
          {/* Header */}
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-card/50 backdrop-blur-sm px-4">
            <SidebarTrigger className="-ml-1" />
            <SidebarSeparator orientation="vertical" className="mr-2 h-4" />
            <div className="flex-1">
              <h1 className="text-xl font-bold">{getSectionTitle()}</h1>
            </div>
            <div className="hidden md:block">
              <GlobalSearch
                onSelectCliente={(id, nombre) => {
                  setActiveSection("clientes");
                  toast.success(`Cliente: ${nombre}`);
                }}
                onSelectArticulo={(id) => {
                  setActiveSection("articulos");
                  toast.success("Artículo encontrado");
                }}
              />
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-7xl">
              {renderContent()}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
