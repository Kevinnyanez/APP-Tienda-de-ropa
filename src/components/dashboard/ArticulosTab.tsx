import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload, Clock, Edit, Filter, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/currency";

interface Articulo {
  id_articulo: string;
  codigo: number | string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  talle?: string | null;
  color?: string | null;
  temporada?: string | null;
  precio_costo: number;
  precio_venta: number;
  stock_disponible: number;
  stock_reservado: number;
  activo: boolean;
}

const ArticulosTab = () => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [articuloEditando, setArticuloEditando] = useState<Articulo | null>(null);
  const [modoStock, setModoStock] = useState<"agregar" | "reemplazar">("agregar");
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const registrosPorPagina = 25;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    categoria: "",
    talle: "",
    color: "",
    temporada: "",
    precio_costo: "",
    precio_venta: "",
    stock_disponible: "",
  });
  const [formEditData, setFormEditData] = useState({
    nombre: "",
    descripcion: "",
    categoria: "",
    talle: "",
    color: "",
    temporada: "",
    precio_costo: "",
    precio_venta: "",
    stock_adicional: "",
  });

  useEffect(() => {
    fetchArticulos();
    fetchCategorias();
  }, [paginaActual, categoriaFiltro]);

  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm, categoriaFiltro]);

  const sugerirProximoCodigo = async () => {
    const { data } = await supabase
      .from("articulos")
      .select("codigo")
      .order("codigo", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ultimoCodigo = data?.codigo ? Number(data.codigo) : 999;
    const nuevoCodigo = ultimoCodigo + 1;
    setFormData({ ...formData, codigo: nuevoCodigo.toString() });
    toast.info(`Código sugerido: ${nuevoCodigo}`);
  };

  const fetchArticulos = async () => {
    // Construir la consulta base
    let queryCount = supabase
      .from("articulos")
      .select("*", { count: "exact", head: true })
      .eq("activo", true);

    let queryData = supabase
      .from("articulos" as any)
      .select("*")
      .eq("activo", true);

    // Aplicar filtro de categoría si está seleccionado
    if (categoriaFiltro !== "todas") {
      queryCount = queryCount.eq("categoria", categoriaFiltro);
      queryData = queryData.eq("categoria", categoriaFiltro);
    }

    // Obtener el total de registros
    const { count } = await queryCount;

    if (count) {
      setTotalRegistros(count);
    }

    // Obtener la página actual
    const desde = (paginaActual - 1) * registrosPorPagina;
    const { data, error } = await queryData
      .order("nombre")
      .range(desde, desde + registrosPorPagina - 1);

    if (error) {
      toast.error("Error al cargar artículos");
    } else {
      setArticulos((data as any) || []);
    }
  };

  const fetchCategorias = async () => {
    // Obtener todas las categorías únicas
    const { data } = await supabase
      .from("articulos")
      .select("categoria")
      .eq("activo", true)
      .not("categoria", "is", null);

    if (data) {
      const categoriasUnicas = [...new Set(data.map((item: any) => item.categoria))].filter(Boolean);
      setCategorias(categoriasUnicas as string[]);
    }
  };

  const normalizarCategoria = (texto: string): string => {
    if (!texto) return "";
    // Primera letra mayúscula, resto minúsculas
    return texto.trim().charAt(0).toUpperCase() + texto.trim().slice(1).toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Normalizar la categoría antes de guardar
    const categoriaNormalizada = formData.categoria ? normalizarCategoria(formData.categoria) : null;

    const { error } = await supabase.from("articulos" as any).insert({
      codigo: parseInt(formData.codigo),
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      categoria: categoriaNormalizada,
      talle: formData.talle || null,
      color: formData.color || null,
      temporada: formData.temporada || null,
      precio_costo: parseFloat(formData.precio_costo),
      precio_venta: parseFloat(formData.precio_venta),
      stock_disponible: parseInt(formData.stock_disponible),
      user_id: user.id,
    } as any);

    if (error) {
      console.error("Error al crear artículo:", error);
      if (error.code === "23505") {
        // Error de código duplicado
        toast.error("Ya existe un artículo con este código", {
          description: `El código ${formData.codigo} ya está en uso. Por favor, usa otro código.`,
        });
      } else {
        toast.error("No se pudo crear el artículo", {
          description: error.message || "Verifica que todos los campos sean correctos",
        });
      }
    } else {
      toast.success("Artículo creado exitosamente");
      setOpen(false);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
        categoria: "",
        talle: "",
        color: "",
        temporada: "",
        precio_costo: "",
        precio_venta: "",
        stock_disponible: "",
      });
      setPaginaActual(1);
      fetchArticulos();
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Obtener el código más alto actual
        const { data: maxArticulo } = await supabase
          .from("articulos")
          .select("codigo")
          .order("codigo", { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextCodigo = maxArticulo?.codigo ? Number(maxArticulo.codigo) + 1 : 1000;

        const articulosToInsert = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[1]) continue; // Skip if no PRENDA

          const cantidad = parseInt(row[0]?.toString() || "1");
          const nombre = row[1]?.toString() || "";
          const descripcion = row[2]?.toString() || null;
          const talle = row[3]?.toString() || null;
          const color = row[4]?.toString() || null;
          const precio = parseFloat(row[5]?.toString() || "0");
          const temporada = row[6]?.toString() || null;

          for (let j = 0; j < cantidad; j++) {
            articulosToInsert.push({
              codigo: nextCodigo++,
              nombre,
              descripcion,
              talle,
              color,
              temporada,
              precio_costo: 0,
              precio_venta: precio,
              stock_disponible: 1,
              user_id: user.id,
            });
          }
        }

        const { error } = await supabase.from("articulos" as any).insert(articulosToInsert as any);

        if (error) {
          toast.error("Error al importar artículos");
        } else {
          toast.success(`${articulosToInsert.length} artículos importados`);
          setPaginaActual(1);
          fetchArticulos();
        }
      } catch (error) {
        toast.error("Error al procesar el archivo");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEditarArticulo = (articulo: Articulo) => {
    setArticuloEditando(articulo);
    setFormEditData({
      nombre: articulo.nombre,
      descripcion: articulo.descripcion || "",
      categoria: articulo.categoria || "",
      talle: articulo.talle || "",
      color: articulo.color || "",
      temporada: articulo.temporada || "",
      precio_costo: articulo.precio_costo.toString(),
      precio_venta: articulo.precio_venta.toString(),
      stock_adicional: "",
    });
    setModoStock("agregar");
    setOpenEdit(true);
  };

  const handleGuardarEdicion = async () => {
    if (!articuloEditando) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Calcular el nuevo stock
    let nuevoStock = articuloEditando.stock_disponible;
    if (formEditData.stock_adicional) {
      const stockNum = parseInt(formEditData.stock_adicional);
      if (modoStock === "agregar") {
        nuevoStock = articuloEditando.stock_disponible + stockNum;
      } else {
        nuevoStock = stockNum;
      }
    }

    // Normalizar la categoría antes de guardar
    const categoriaNormalizada = formEditData.categoria ? normalizarCategoria(formEditData.categoria) : null;

    const { error } = await supabase
      .from("articulos")
      .update({
        nombre: formEditData.nombre,
        descripcion: formEditData.descripcion || null,
        categoria: categoriaNormalizada,
        talle: formEditData.talle || null,
        color: formEditData.color || null,
        temporada: formEditData.temporada || null,
        precio_costo: parseFloat(formEditData.precio_costo),
        precio_venta: parseFloat(formEditData.precio_venta),
        stock_disponible: nuevoStock,
      })
      .eq("id_articulo", articuloEditando.id_articulo);

    if (error) {
      console.error("Error al actualizar artículo:", error);
      toast.error("No se pudo actualizar el artículo");
    } else {
      toast.success("Artículo actualizado exitosamente");
      setOpenEdit(false);
      setArticuloEditando(null);
      fetchArticulos();
    }
  };

  const filteredArticulos = articulos.filter(
    (art) =>
      art.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.codigo.toString().includes(searchTerm) ||
      art.talle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.color?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header con filtros y acciones */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Inventario de Prendas</h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              {totalRegistros} artículo(s)
            </p>
            {(categoriaFiltro !== "todas" || searchTerm) && (
              <Badge variant="secondary" className="gap-1">
                Filtros activos
              </Badge>
            )}
          </div>
        </div>
        
        {/* Botón Limpiar Filtros */}
        {(categoriaFiltro !== "todas" || searchTerm) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCategoriaFiltro("todas");
              setSearchTerm("");
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Limpiar Filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nombre, talle o color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className={`w-56 ${categoriaFiltro !== "todas" ? "border-primary" : ""}`}>
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">
              <div className="flex items-center justify-between w-full">
                <span>📂 Todas las categorías</span>
              </div>
            </SelectItem>
            {categorias.sort().map((cat) => (
              <SelectItem key={cat} value={cat}>
                📁 {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex gap-2 ml-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            variant="outline"
            className="h-11 text-base"
          >
            <Upload className="mr-2 h-5 w-5" />
            Importar Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 text-base">
                <Plus className="mr-2 h-5 w-5" />
                Nuevo Artículo
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Artículo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código (numérico) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="codigo"
                      type="number"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData({ ...formData, codigo: e.target.value })
                      }
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sugerirProximoCodigo}
                      className="whitespace-nowrap"
                    >
                      Sugerir
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre/Prenda *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="talle">Talle</Label>
                  <Input
                    id="talle"
                    value={formData.talle}
                    onChange={(e) =>
                      setFormData({ ...formData, talle: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temporada">Temporada</Label>
                  <Input
                    id="temporada"
                    value={formData.temporada}
                    onChange={(e) =>
                      setFormData({ ...formData, temporada: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Select
                  value={formData.categoria || "nueva"}
                  onValueChange={(value) => {
                    if (value === "nueva") {
                      setFormData({ ...formData, categoria: "" });
                    } else {
                      setFormData({ ...formData, categoria: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar o escribir nueva" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nueva">
                      <span className="text-muted-foreground">✏️ Escribir nueva categoría...</span>
                    </SelectItem>
                    {categorias.sort().map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        📁 {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!formData.categoria || formData.categoria === "") && (
                  <Input
                    placeholder="Ej: Remeras, Pantalones..."
                    value={formData.categoria}
                    onChange={(e) => {
                      const valor = normalizarCategoria(e.target.value);
                      setFormData({ ...formData, categoria: valor });
                    }}
                    className="mt-2"
                  />
                )}
                {formData.categoria && formData.categoria !== "" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Se guardará como: <strong>{normalizarCategoria(formData.categoria)}</strong>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precio_costo">Precio Costo *</Label>
                  <Input
                    id="precio_costo"
                    type="number"
                    step="0.01"
                    value={formData.precio_costo}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_costo: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio_venta">Precio Venta *</Label>
                  <Input
                    id="precio_venta"
                    type="number"
                    step="0.01"
                    value={formData.precio_venta}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_venta: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Inicial *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_disponible}
                  onChange={(e) =>
                    setFormData({ ...formData, stock_disponible: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Crear Artículo
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Diálogo de Edición */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Artículo - {articuloEditando?.codigo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre/Prenda *</Label>
                <Input
                  id="edit-nombre"
                  value={formEditData.nombre}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, nombre: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción</Label>
                <Input
                  id="edit-descripcion"
                  value={formEditData.descripcion}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, descripcion: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-talle">Talle</Label>
                <Input
                  id="edit-talle"
                  value={formEditData.talle}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, talle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  value={formEditData.color}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, color: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-temporada">Temporada</Label>
                <Input
                  id="edit-temporada"
                  value={formEditData.temporada}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, temporada: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-categoria">Categoría</Label>
              <Select
                value={formEditData.categoria || "nueva"}
                onValueChange={(value) => {
                  if (value === "nueva") {
                    setFormEditData({ ...formEditData, categoria: "" });
                  } else {
                    setFormEditData({ ...formEditData, categoria: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar o escribir nueva" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nueva">
                    <span className="text-muted-foreground">✏️ Escribir nueva categoría...</span>
                  </SelectItem>
                  {categorias.sort().map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      📁 {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!formEditData.categoria || formEditData.categoria === "") && (
                <Input
                  placeholder="Ej: Remeras, Pantalones..."
                  value={formEditData.categoria}
                  onChange={(e) => {
                    const valor = normalizarCategoria(e.target.value);
                    setFormEditData({ ...formEditData, categoria: valor });
                  }}
                  className="mt-2"
                />
              )}
              {formEditData.categoria && formEditData.categoria !== "" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Se guardará como: <strong>{normalizarCategoria(formEditData.categoria)}</strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-precio_costo">Precio Costo *</Label>
                <Input
                  id="edit-precio_costo"
                  type="number"
                  step="0.01"
                  value={formEditData.precio_costo}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, precio_costo: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-precio_venta">Precio Venta *</Label>
                <Input
                  id="edit-precio_venta"
                  type="number"
                  step="0.01"
                  value={formEditData.precio_venta}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, precio_venta: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Sección de Stock */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Actualizar Stock</Label>
                <Badge variant="outline" className="text-base">
                  Stock actual: {articuloEditando?.stock_disponible || 0}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Modo de actualización</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={modoStock === "agregar" ? "default" : "outline"}
                    onClick={() => setModoStock("agregar")}
                    className="flex-1"
                  >
                    Agregar Stock
                  </Button>
                  <Button
                    type="button"
                    variant={modoStock === "reemplazar" ? "default" : "outline"}
                    onClick={() => setModoStock("reemplazar")}
                    className="flex-1"
                  >
                    Reemplazar Stock
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {modoStock === "agregar" 
                    ? "El stock ingresado se sumará al stock actual"
                    : "El stock ingresado reemplazará completamente el stock actual"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stock">
                  {modoStock === "agregar" ? "Cantidad a agregar" : "Nuevo stock total"}
                </Label>
                <Input
                  id="edit-stock"
                  type="number"
                  min="0"
                  placeholder={modoStock === "agregar" ? "Ej: 10 (se sumará)" : "Ej: 25 (será el total)"}
                  value={formEditData.stock_adicional}
                  onChange={(e) =>
                    setFormEditData({ ...formEditData, stock_adicional: e.target.value })
                  }
                />
                {formEditData.stock_adicional && (
                  <p className="text-sm font-medium text-primary">
                    {modoStock === "agregar"
                      ? `Nuevo stock: ${articuloEditando?.stock_disponible || 0} + ${formEditData.stock_adicional} = ${(articuloEditando?.stock_disponible || 0) + parseInt(formEditData.stock_adicional)}`
                      : `Nuevo stock: ${formEditData.stock_adicional}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleGuardarEdicion} className="flex-1">
                Guardar Cambios
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOpenEdit(false);
                  setArticuloEditando(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Talle</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Temporada</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock Disp.</TableHead>
              <TableHead>Reservado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredArticulos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No hay artículos registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredArticulos.map((art) => (
                <TableRow key={art.id_articulo}>
                  <TableCell className="font-mono">{art.codigo}</TableCell>
                  <TableCell className="font-medium">{art.nombre}</TableCell>
                  <TableCell>{art.talle || "-"}</TableCell>
                  <TableCell>{art.color || "-"}</TableCell>
                  <TableCell>
                    {art.temporada ? (
                      <Badge variant="outline">{art.temporada}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(art.precio_venta)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant={art.stock_disponible > 0 ? "default" : "destructive"}
                        className="w-fit"
                      >
                        {art.stock_disponible}
                      </Badge>
                      {art.stock_disponible === 0 && art.stock_reservado > 0 && (
                        <span className="text-xs text-muted-foreground">Sin stock</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {art.stock_reservado > 0 ? (
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant="outline" 
                          className="bg-yellow-50 text-yellow-700 border-yellow-200 w-fit"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {art.stock_reservado}
                        </Badge>
                        <span className="text-xs text-muted-foreground">En espera</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditarArticulo(art)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
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
            Mostrando {Math.min((paginaActual - 1) * registrosPorPagina + 1, totalRegistros)} - {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} artículos
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

export default ArticulosTab;
