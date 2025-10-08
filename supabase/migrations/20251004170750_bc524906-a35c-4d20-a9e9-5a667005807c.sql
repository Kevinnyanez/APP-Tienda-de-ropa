-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create clientes table
CREATE TABLE public.clientes (
  id_cliente UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create articulos table
CREATE TABLE public.articulos (
  id_articulo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  precio_costo DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_disponible INTEGER NOT NULL DEFAULT 0,
  stock_reservado INTEGER NOT NULL DEFAULT 0,
  fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ventas table
CREATE TABLE public.ventas (
  id_venta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_cliente UUID REFERENCES public.clientes(id_cliente) ON DELETE SET NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'pago', 'deuda')),
  tipo_pago TEXT,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create detalle_venta table
CREATE TABLE public.detalle_venta (
  id_detalle UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_venta UUID REFERENCES public.ventas(id_venta) ON DELETE CASCADE NOT NULL,
  id_articulo UUID REFERENCES public.articulos(id_articulo) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  estado_articulo TEXT NOT NULL CHECK (estado_articulo IN ('pendiente', 'pago', 'deuda')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create movimientos_caja table
CREATE TABLE public.movimientos_caja (
  id_movimiento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  monto DECIMAL(10,2) NOT NULL,
  medio_pago TEXT,
  descripcion TEXT,
  id_venta UUID REFERENCES public.ventas(id_venta) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing authenticated users full access for now)
CREATE POLICY "Allow authenticated users full access to clientes"
ON public.clientes FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to articulos"
ON public.articulos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to ventas"
ON public.ventas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to detalle_venta"
ON public.detalle_venta FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to movimientos_caja"
ON public.movimientos_caja FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_clientes_activo ON public.clientes(activo);
CREATE INDEX idx_clientes_dni ON public.clientes(dni);
CREATE INDEX idx_articulos_codigo ON public.articulos(codigo);
CREATE INDEX idx_articulos_categoria ON public.articulos(categoria);
CREATE INDEX idx_articulos_activo ON public.articulos(activo);
CREATE INDEX idx_ventas_cliente ON public.ventas(id_cliente);
CREATE INDEX idx_ventas_estado ON public.ventas(estado);
CREATE INDEX idx_ventas_fecha ON public.ventas(fecha);
CREATE INDEX idx_detalle_venta_venta ON public.detalle_venta(id_venta);
CREATE INDEX idx_detalle_venta_articulo ON public.detalle_venta(id_articulo);
CREATE INDEX idx_movimientos_fecha ON public.movimientos_caja(fecha);
CREATE INDEX idx_movimientos_tipo ON public.movimientos_caja(tipo);