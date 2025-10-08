-- ============================================
-- MIGRACIÓN PARA SISTEMA DE CUENTA CORRIENTE
-- ============================================

-- 1. Añadir campos faltantes a la tabla 'articulos' si no existen
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articulos' AND column_name='talle') THEN
        ALTER TABLE public.articulos ADD COLUMN talle TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articulos' AND column_name='color') THEN
        ALTER TABLE public.articulos ADD COLUMN color TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articulos' AND column_name='temporada') THEN
        ALTER TABLE public.articulos ADD COLUMN temporada TEXT;
    END IF;
END $$;

-- 2. Añadir campos faltantes a la tabla 'ventas' si no existen
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ventas' AND column_name='metodo_pago') THEN
        ALTER TABLE public.ventas ADD COLUMN metodo_pago TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ventas' AND column_name='notas') THEN
        ALTER TABLE public.ventas ADD COLUMN notas TEXT;
    END IF;
    -- Actualizar la columna 'estado' para incluir 'cancelado' si no existe
    ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
    ALTER TABLE public.ventas ADD CONSTRAINT ventas_estado_check CHECK (estado IN ('pendiente', 'pago', 'deuda', 'cancelado'));
END $$;

-- 3. Modificar la tabla 'detalle_venta'
DO $$ BEGIN
    -- Añadir id_cliente si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='detalle_venta' AND column_name='id_cliente') THEN
        ALTER TABLE public.detalle_venta ADD COLUMN id_cliente UUID REFERENCES public.clientes(id_cliente) ON DELETE SET NULL;
    END IF;

    -- Actualizar la restricción CHECK para estado_articulo para incluir 'cancelado'
    ALTER TABLE public.detalle_venta DROP CONSTRAINT IF EXISTS detalle_venta_estado_articulo_check;
    ALTER TABLE public.detalle_venta ADD CONSTRAINT detalle_venta_estado_articulo_check CHECK (estado_articulo IN ('pendiente', 'pago', 'deuda', 'cancelado'));
END $$;

-- 4. Función para ajustar stock según el estado del artículo
CREATE OR REPLACE FUNCTION public.ajustar_stock_por_estado()
RETURNS TRIGGER AS $$
DECLARE
    cantidad_articulo INTEGER;
    articulo_activo BOOLEAN;
BEGIN
    SELECT stock_disponible, activo INTO cantidad_articulo, articulo_activo
    FROM public.articulos
    WHERE id_articulo = NEW.id_articulo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artículo con ID % no encontrado', NEW.id_articulo;
    END IF;

    -- Lógica para el estado anterior (OLD) cuando es UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado_articulo = 'pendiente' OR OLD.estado_articulo = 'deuda' THEN
            -- Si estaba reservado, liberar stock_reservado
            UPDATE public.articulos
            SET stock_reservado = stock_reservado - OLD.cantidad
            WHERE id_articulo = OLD.id_articulo;
        ELSIF OLD.estado_articulo = 'pago' THEN
            -- Si estaba pagado, no se toca el stock (ya fue descontado)
            NULL;
        ELSIF OLD.estado_articulo = 'cancelado' THEN
            -- Si estaba cancelado, no se hace nada
            NULL;
        END IF;
    END IF;

    -- Lógica para el nuevo estado (NEW)
    IF NEW.estado_articulo = 'pendiente' OR NEW.estado_articulo = 'deuda' THEN
        -- Si pasa a pendiente o deuda, reservar stock
        UPDATE public.articulos
        SET stock_disponible = stock_disponible - NEW.cantidad,
            stock_reservado = stock_reservado + NEW.cantidad
        WHERE id_articulo = NEW.id_articulo;
    ELSIF NEW.estado_articulo = 'pago' THEN
        -- Si pasa a pagado, liberar stock_reservado (ya se descontó de disponible)
        UPDATE public.articulos
        SET stock_reservado = stock_reservado - NEW.cantidad
        WHERE id_articulo = NEW.id_articulo;
    ELSIF NEW.estado_articulo = 'cancelado' THEN
        -- Si pasa a cancelado, devolver stock a disponible
        UPDATE public.articulos
        SET stock_disponible = stock_disponible + NEW.cantidad
        WHERE id_articulo = NEW.id_articulo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Triggers para ajustar stock automáticamente
DROP TRIGGER IF EXISTS on_detalle_venta_insert ON public.detalle_venta;
CREATE TRIGGER on_detalle_venta_insert
AFTER INSERT ON public.detalle_venta
FOR EACH ROW EXECUTE FUNCTION public.ajustar_stock_por_estado();

DROP TRIGGER IF EXISTS on_detalle_venta_update ON public.detalle_venta;
CREATE TRIGGER on_detalle_venta_update
AFTER UPDATE OF estado_articulo ON public.detalle_venta
FOR EACH ROW EXECUTE FUNCTION public.ajustar_stock_por_estado();

-- 6. Función para registrar movimiento de caja al cambiar a 'pago'
CREATE OR REPLACE FUNCTION public.registrar_movimiento_caja_venta()
RETURNS TRIGGER AS $$
DECLARE
    cliente_nombre TEXT;
    cliente_apellido TEXT;
    venta_total DECIMAL(10,2);
    venta_metodo_pago TEXT;
    venta_id_cliente UUID;
BEGIN
    IF NEW.estado_articulo = 'pago' AND (OLD IS NULL OR OLD.estado_articulo != 'pago') THEN
        -- Obtener detalles de la venta y cliente
        SELECT v.total, v.metodo_pago, v.id_cliente
        INTO venta_total, venta_metodo_pago, venta_id_cliente
        FROM public.ventas v
        WHERE v.id_venta = NEW.id_venta;

        IF venta_id_cliente IS NOT NULL THEN
            SELECT c.nombre, c.apellido
            INTO cliente_nombre, cliente_apellido
            FROM public.clientes c
            WHERE c.id_cliente = venta_id_cliente;
        END IF;

        INSERT INTO public.movimientos_caja (tipo, monto, medio_pago, descripcion, id_venta)
        VALUES (
            'entrada',
            NEW.cantidad * NEW.precio_unitario,
            COALESCE(venta_metodo_pago, 'efectivo'),
            'Venta a ' || COALESCE(cliente_nombre || ' ' || cliente_apellido, 'Cliente General'),
            NEW.id_venta
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para registrar movimiento de caja
DROP TRIGGER IF EXISTS on_detalle_venta_pago ON public.detalle_venta;
CREATE TRIGGER on_detalle_venta_pago
AFTER INSERT OR UPDATE OF estado_articulo ON public.detalle_venta
FOR EACH ROW EXECUTE FUNCTION public.registrar_movimiento_caja_venta();

-- 8. Función para calcular saldo de cliente
CREATE OR REPLACE FUNCTION public.calcular_saldo_cliente(p_id_cliente UUID)
RETURNS TABLE (
    total_pendiente DECIMAL(10,2),
    total_deuda DECIMAL(10,2),
    total_pagado DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN dv.estado_articulo = 'pendiente' THEN dv.cantidad * dv.precio_unitario ELSE 0 END), 0)::DECIMAL(10,2) AS total_pendiente,
        COALESCE(SUM(CASE WHEN dv.estado_articulo = 'deuda' THEN dv.cantidad * dv.precio_unitario ELSE 0 END), 0)::DECIMAL(10,2) AS total_deuda,
        COALESCE(SUM(CASE WHEN dv.estado_articulo = 'pago' THEN dv.cantidad * dv.precio_unitario ELSE 0 END), 0)::DECIMAL(10,2) AS total_pagado
    FROM
        public.detalle_venta dv
    WHERE
        dv.id_cliente = p_id_cliente;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

