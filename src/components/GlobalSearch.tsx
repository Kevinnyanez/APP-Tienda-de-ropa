import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, Users, Package, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  type: "cliente" | "articulo" | "venta";
  id: string;
  titulo: string;
  subtitulo: string;
  info?: string;
  data?: any;
}

interface GlobalSearchProps {
  onSelectCliente?: (clienteId: string, nombre: string) => void;
  onSelectArticulo?: (articuloId: string) => void;
}

const GlobalSearch = ({ onSelectCliente, onSelectArticulo }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }

    const delaySearch = setTimeout(() => {
      performSearch(search);
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [search]);

  const performSearch = async (query: string) => {
    setLoading(true);
    const searchResults: SearchResult[] = [];
    const searchTerm = `%${query}%`;

    try {
      // Buscar Clientes - Búsqueda en nombre
      const { data: clientesPorNombre, error: errorNombre } = await supabase
        .from("clientes")
        .select("id_cliente, nombre, apellido, dni, telefono")
        .eq("activo", true)
        .ilike("nombre", searchTerm)
        .limit(3);

      // Buscar Clientes - Búsqueda en apellido
      const { data: clientesPorApellido, error: errorApellido } = await supabase
        .from("clientes")
        .select("id_cliente, nombre, apellido, dni, telefono")
        .eq("activo", true)
        .ilike("apellido", searchTerm)
        .limit(3);

      // Buscar Clientes - Búsqueda en DNI
      const { data: clientesPorDNI, error: errorDNI } = await supabase
        .from("clientes")
        .select("id_cliente, nombre, apellido, dni, telefono")
        .eq("activo", true)
        .ilike("dni", searchTerm)
        .limit(3);

      // Combinar resultados de clientes (sin duplicados)
      const clientesMap = new Map();
      [clientesPorNombre, clientesPorApellido, clientesPorDNI].forEach(clientes => {
        if (clientes) {
          clientes.forEach((cliente) => {
            if (!clientesMap.has(cliente.id_cliente)) {
              clientesMap.set(cliente.id_cliente, cliente);
            }
          });
        }
      });

      Array.from(clientesMap.values()).slice(0, 5).forEach((cliente: any) => {
        searchResults.push({
          type: "cliente",
          id: cliente.id_cliente,
          titulo: `${cliente.nombre} ${cliente.apellido}`,
          subtitulo: cliente.dni || cliente.telefono || "Sin DNI",
          info: "Cliente",
          data: cliente,
        });
      });

      // Buscar Artículos - Por nombre
      const { data: articulosPorNombre, error: errorArtNombre } = await supabase
        .from("articulos")
        .select("id_articulo, codigo, nombre, precio_venta, stock_disponible, talle, color")
        .eq("activo", true)
        .ilike("nombre", searchTerm)
        .limit(3);

      // Buscar Artículos - Por color
      const { data: articulosPorColor, error: errorArtColor } = await supabase
        .from("articulos")
        .select("id_articulo, codigo, nombre, precio_venta, stock_disponible, talle, color")
        .eq("activo", true)
        .ilike("color", searchTerm)
        .limit(3);

      // Buscar Artículos - Por código (si es numérico)
      let articulosPorCodigo = null;
      if (!isNaN(Number(query))) {
        const { data } = await supabase
          .from("articulos")
          .select("id_articulo, codigo, nombre, precio_venta, stock_disponible, talle, color")
          .eq("activo", true)
          .eq("codigo", Number(query))
          .limit(3);
        articulosPorCodigo = data;
      }

      // Combinar resultados de artículos (sin duplicados)
      const articulosMap = new Map();
      [articulosPorNombre, articulosPorColor, articulosPorCodigo].forEach(articulos => {
        if (articulos) {
          articulos.forEach((art) => {
            if (!articulosMap.has(art.id_articulo)) {
              articulosMap.set(art.id_articulo, art);
            }
          });
        }
      });

      Array.from(articulosMap.values()).slice(0, 5).forEach((art: any) => {
        searchResults.push({
          type: "articulo",
          id: art.id_articulo,
          titulo: `${art.codigo} - ${art.nombre}`,
          subtitulo: `Stock: ${art.stock_disponible} | ${formatCurrency(art.precio_venta)}`,
          info: art.talle || art.color ? `${art.talle || ''} ${art.color || ''}`.trim() : undefined,
          data: art,
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error("Error en búsqueda:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === "cliente" && onSelectCliente) {
      onSelectCliente(result.id, result.titulo);
    } else if (result.type === "articulo" && onSelectArticulo) {
      onSelectArticulo(result.id);
    }
    setOpen(false);
    setSearch("");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "cliente":
        return <Users className="h-4 w-4 text-violet-500" />;
      case "articulo":
        return <Package className="h-4 w-4 text-orange-500" />;
      case "venta":
        return <TrendingUp className="h-4 w-4 text-rose-500" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Botón de Búsqueda */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors w-full max-w-md"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1 text-left">
          Buscar clientes o artículos...
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>

      {/* Diálogo de Búsqueda */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar por nombre, DNI, código de prenda..."
          value={search}
          onValueChange={setSearch}
          autoFocus
        />
        <CommandList className="max-h-[400px]">
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          )}

          {!loading && search.length >= 2 && results.length === 0 && (
            <CommandEmpty>
              <div className="py-6 text-center">
                <p className="text-sm font-medium">No se encontraron resultados</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Intenta buscar por: nombre, DNI, código de prenda
                </p>
              </div>
            </CommandEmpty>
          )}

          {!loading && search.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              {/* Clientes */}
              {results.some((r) => r.type === "cliente") && (
                <CommandGroup heading="Clientes">
                  {results
                    .filter((r) => r.type === "cliente")
                    .map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.titulo}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-3 py-3 cursor-pointer"
                      >
                        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/20">
                          {getIcon(result.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{result.titulo}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.subtitulo}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-violet-600">
                          Cliente
                        </Badge>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}

              {/* Artículos */}
              {results.some((r) => r.type === "articulo") && (
                <CommandGroup heading="Artículos en Inventario">
                  {results
                    .filter((r) => r.type === "articulo")
                    .map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.titulo}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-3 py-3 cursor-pointer"
                      >
                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                          {getIcon(result.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{result.titulo}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.subtitulo}
                          </div>
                          {result.info && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {result.info}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={
                            result.data?.stock_disponible > 0
                              ? "default"
                              : "destructive"
                          }
                        >
                          {result.data?.stock_disponible > 0
                            ? "Disponible"
                            : "Sin stock"}
                        </Badge>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default GlobalSearch;

