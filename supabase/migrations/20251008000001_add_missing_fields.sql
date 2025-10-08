-- Migración segura: Agregar solo los campos faltantes

-- Agregar campos a la tabla articulos (si no existen)
ALTER TABLE public.articulos 
  ADD COLUMN IF NOT EXISTS talle TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS temporada TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Agregar campos a la tabla ventas (si no existen)
ALTER TABLE public.ventas 
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Agregar campos a la tabla clientes (si no existen)
ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Agregar campos a la tabla detalle_venta (si no existen)
ALTER TABLE public.detalle_venta 
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Agregar campos a la tabla movimientos_caja (si no existen)
ALTER TABLE public.movimientos_caja 
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
  ADD COLUMN IF NOT EXISTS concepto TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS id_venta UUID REFERENCES public.ventas(id_venta);

-- Actualizar las restricciones de estado para incluir 'cancelado'
-- Primero eliminar las restricciones existentes
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
ALTER TABLE public.detalle_venta DROP CONSTRAINT IF EXISTS detalle_venta_estado_articulo_check;

-- Recrear con el nuevo estado 'cancelado'
ALTER TABLE public.ventas 
  ADD CONSTRAINT ventas_estado_check 
  CHECK (estado IN ('pendiente', 'pago', 'deuda', 'cancelado'));

ALTER TABLE public.detalle_venta 
  ADD CONSTRAINT detalle_venta_estado_articulo_check 
  CHECK (estado_articulo IN ('pendiente', 'pago', 'deuda', 'cancelado'));

-- Función para actualizar stock al crear/actualizar detalle_venta
CREATE OR REPLACE FUNCTION actualizar_stock_detalle_venta()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Cuando se crea un nuevo detalle: restar del disponible, sumar a reservado
    UPDATE public.articulos
    SET 
      stock_disponible = GREATEST(stock_disponible - NEW.cantidad, 0),
      stock_reservado = stock_reservado + NEW.cantidad
    WHERE id_articulo = NEW.id_articulo;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Cuando cambia el estado
    IF (OLD.estado_articulo != NEW.estado_articulo) THEN
      
      -- Si pasa a 'pago': liberar del reservado (venta completada)
      IF (NEW.estado_articulo = 'pago') THEN
        UPDATE public.articulos
        SET stock_reservado = GREATEST(stock_reservado - NEW.cantidad, 0)
        WHERE id_articulo = NEW.id_articulo;
      
      -- Si se cancela: devolver a disponible y quitar de reservado
      ELSIF (NEW.estado_articulo = 'cancelado') THEN
        UPDATE public.articulos
        SET 
          stock_disponible = stock_disponible + NEW.cantidad,
          stock_reservado = GREATEST(stock_reservado - NEW.cantidad, 0)
        WHERE id_articulo = NEW.id_articulo;
      END IF;
    END IF;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Si se elimina: recuperar stock
    UPDATE public.articulos
    SET 
      stock_disponible = stock_disponible + OLD.cantidad,
      stock_reservado = GREATEST(stock_reservado - OLD.cantidad, 0)
    WHERE id_articulo = OLD.id_articulo;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger (eliminar si existe primero)
DROP TRIGGER IF EXISTS trigger_actualizar_stock_detalle ON public.detalle_venta;
CREATE TRIGGER trigger_actualizar_stock_detalle
  AFTER INSERT OR UPDATE OR DELETE ON public.detalle_venta
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_stock_detalle_venta();

-- Índices adicionales para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_detalle_venta_estado ON public.detalle_venta(estado_articulo);
CREATE INDEX IF NOT EXISTS idx_ventas_user ON public.ventas(user_id);
CREATE INDEX IF NOT EXISTS idx_articulos_user ON public.articulos(user_id);
CREATE INDEX IF NOT EXISTS idx_articulos_talle ON public.articulos(talle);
CREATE INDEX IF NOT EXISTS idx_articulos_color ON public.articulos(color);

