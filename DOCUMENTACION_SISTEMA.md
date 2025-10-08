# Sistema de Punto de Venta - Administración Mariana

## 📋 Descripción General

Sistema completo de punto de venta diseñado específicamente para boutiques de ropa con **sistema de cuenta corriente** y manejo inteligente de stock.

---

## 🎯 Características Principales

### 1. **Sistema de Cuenta Corriente por Cliente**

El sistema permite manejar 3 estados de venta diferentes:

#### **Estado: PENDIENTE (Se está probando)** 🟡
- El cliente se llevó la prenda a probarse
- Aún no decidió si la comprará
- **Stock**: Baja del disponible y pasa a reservado
- **Dinero**: NO entra en caja todavía
- **Uso**: Cliente duda y quiere probarse en casa

#### **Estado: PAGO (Compró y pagó)** 🟢
- El cliente compró y pagó la prenda
- **Stock**: Baja del reservado (venta completa)
- **Dinero**: Entra en caja inmediatamente
- **Uso**: Venta directa con pago

#### **Estado: DEUDA (Se llevó pero debe)** 🔴
- El cliente se llevó la prenda pero debe dinero
- **Stock**: Baja del reservado
- **Dinero**: NO entra en caja (pendiente de cobro)
- **Uso**: Cliente de confianza que paga después

#### **Estado: CANCELADO (Devolvió)** ⚪
- El cliente devolvió la prenda
- **Stock**: Se recupera al disponible
- **Dinero**: No hay movimiento
- **Uso**: Cliente probó y no le gustó

---

## 🔄 Flujo de Trabajo

### Escenario 1: Cliente se prueba ropa
1. Ir a **Clientes** → Seleccionar cliente
2. Click en **"Agregar Prenda al Cliente"**
3. Seleccionar artículo y cantidad
4. Estado: **"Pendiente (Se está probando)"**
5. ✅ Stock baja y queda reservado

### Escenario 2: Cliente decidió comprar y paga
1. En la cuenta del cliente, cambiar estado a **"Pago"**
2. ✅ Stock se libera (venta completa)
3. ✅ Dinero entra en caja automáticamente

### Escenario 3: Cliente se lleva a cuenta
1. En la cuenta del cliente, cambiar estado a **"Deuda"**
2. ✅ Stock se queda reservado (ya se lo llevó)
3. ⏸️ Dinero NO entra en caja
4. Cuando pague, cambiar a **"Pago"**

### Escenario 4: Cliente devuelve
1. Cambiar estado a **"Cancelado"**
2. ✅ Stock vuelve a disponible
3. ℹ️ La prenda está nuevamente disponible

---

## 🏪 Secciones del Sistema

### 🛒 **Punto de Venta** (Tab Principal)
- **Propósito**: Ventas rápidas directas
- **Características**:
  - Botones GRANDES de método de pago
  - Input de monto XL
  - Cliente opcional
  - Registro inmediato en caja

### 💰 **Caja**
- **Propósito**: Gestión de dinero
- **3 Botones Principales**:
  - **Registrar Venta** (Verde): Ingresos
  - **Registrar Compra** (Naranja): Gastos/mercadería
  - **Registrar Retiro** (Rojo): Retiros de efectivo
- **Estadísticas por período**: Hoy, Semana, Mes
- **Desglose por método de pago**

### 📊 **Historial**
- Consulta de ventas anteriores
- Últimas 50 ventas
- Filtros por fecha

### 📦 **Artículos**
- Gestión de inventario
- **Botón "Sugerir Código"**: Genera automáticamente el siguiente código disponible
- Importación masiva desde Excel
- Campos: Código, Nombre, Talle, Color, Temporada, Precios, Stock

### 👥 **Clientes**
- Gestión de clientes
- **Vista de Cuenta Corriente**: Click en cualquier cliente
- Historial completo de prendas
- Totales por estado (Probándose, Debe, Pagado)

---

## 📊 Estadísticas en Tiempo Real

### Tarjetas Principales (Actualizan cada minuto)
- **Entradas del día** (Verde): Todo el dinero que entra
- **Salidas del día** (Rojo): Todo el dinero que sale
- **Saldo del día** (Azul): Balance neto

### Tarjetas Secundarias
- Ventas totales del día
- Stock total disponible
- Total de artículos
- Total de clientes

---

## 🎨 Diseño Intuitivo

### Para Usuarios Sin Experiencia Tecnológica
✅ Botones GIGANTES con colores distintivos
✅ Textos grandes y claros
✅ Iconos descriptivos
✅ Menos pasos para completar acciones
✅ Instrucciones en pantalla
✅ Colores intuitivos:
  - 🟢 Verde = Ingresos/Ventas
  - 🔴 Rojo = Gastos/Retiros
  - 🟠 Naranja = Compras
  - 🟡 Amarillo = Pendiente
  - 🔵 Azul = Información

---

## 💾 Manejo Automático de Stock

El sistema maneja el stock automáticamente mediante **triggers en la base de datos**:

### Cuando se agrega una prenda a un cliente:
```
Stock Disponible: -cantidad
Stock Reservado: +cantidad
```

### Cuando cambia a "Pago":
```
Stock Reservado: -cantidad
(Se vendió definitivamente)
```

### Cuando cambia a "Cancelado":
```
Stock Disponible: +cantidad
Stock Reservado: -cantidad
(Se recupera)
```

---

## 🔒 Seguridad

- Autenticación requerida (Supabase Auth)
- Row Level Security (RLS) activado
- Solo usuarios autenticados pueden acceder
- Cada registro tiene user_id para auditoría

---

## 📱 Accesibilidad

- ✅ Responsive (funciona en tablets y móviles)
- ✅ Evita zoom automático en móviles
- ✅ Botones táctiles grandes
- ✅ Contraste adecuado
- ✅ Focus visible para navegación por teclado

---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

**clientes**
- Información del cliente
- Cuenta corriente asociada

**articulos**
- Inventario completo
- Stock disponible y reservado
- Talle, color, temporada

**ventas**
- Registro de ventas
- Estado (pendiente, pago, deuda, cancelado)
- Vinculado a cliente

**detalle_venta**
- Items de cada venta
- Estado individual por artículo
- **Trigger automático** para manejo de stock

**movimientos_caja**
- Registro completo de entradas y salidas
- Vinculado a ventas cuando corresponde

---

## 🚀 Ventajas del Sistema

1. **Control total del stock**: Sabe exactamente qué está probándose y qué se vendió
2. **Cuenta corriente por cliente**: Manejo de deudas y pruebas
3. **Estadísticas en tiempo real**: Decisiones basadas en datos
4. **Fácil de usar**: Diseñado para personas sin experiencia
5. **Auditoría completa**: Cada acción queda registrada
6. **Flexible**: Se adapta al flujo real de una boutique

---

## 📞 Flujos de Uso Típicos

### Caso A: Venta directa simple
1. Tab **"Punto de Venta"**
2. Ingresar monto
3. Click en botón de método de pago
4. ✅ Listo

### Caso B: Cliente se prueba ropa
1. Tab **"Clientes"** → Buscar/Crear cliente
2. Click en cliente → **"Agregar Prenda"**
3. Seleccionar artículo, estado **"Pendiente"**
4. ✅ Stock reservado, esperando decisión

### Caso C: Cliente vuelve y compra
1. Tab **"Clientes"** → Click en cliente
2. Cambiar estado de prenda de **"Pendiente"** a **"Pago"**
3. ✅ Dinero entra en caja, stock se libera

### Caso D: Cliente se lleva a cuenta
1. Tab **"Clientes"** → Click en cliente
2. Cambiar estado a **"Deuda"**
3. ✅ Queda registrado lo que debe
4. Cuando pague, cambiar a **"Pago"**

---

## 🎯 Objetivos Cumplidos

- ✅ Sistema de cuenta corriente completo
- ✅ Manejo inteligente de stock según estados
- ✅ Interfaz intuitiva para usuarios sin experiencia
- ✅ Estadísticas en tiempo real
- ✅ Control de caja completo (ventas, compras, retiros)
- ✅ Adaptado al flujo real de boutiques de ropa
- ✅ Registro automático de movimientos
- ✅ Código sugerido automático para artículos

---

## 🔧 Mantenimiento

### Aplicar nueva migración
Ejecutar en Supabase:
```sql
-- Archivo: supabase/migrations/20251008000000_cuenta_corriente_system.sql
```

Esto agrega:
- Triggers para manejo automático de stock
- Función para calcular saldo de clientes
- Campos adicionales necesarios
- Estado "cancelado"

---

**Sistema desarrollado para Administración Mariana** 
Diseño enfocado en usabilidad y flujo real de boutiques de ropa.

