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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    fetchArticulos();
  }, []);

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
    const { data, error } = await supabase
      .from("articulos" as any)
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) {
      toast.error("Error al cargar artículos");
    } else {
      setArticulos((data as any) || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("articulos" as any).insert({
      codigo: parseInt(formData.codigo),
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      categoria: formData.categoria || null,
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
          fetchArticulos();
        }
      } catch (error) {
        toast.error("Error al procesar el archivo");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nombre, talle o color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData({ ...formData, categoria: e.target.value })
                  }
                />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredArticulos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                  <TableCell>${art.precio_venta.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={art.stock_disponible > 0 ? "default" : "destructive"}>
                      {art.stock_disponible}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {art.stock_reservado > 0 ? (
                      <Badge variant="secondary">{art.stock_reservado}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ArticulosTab;
