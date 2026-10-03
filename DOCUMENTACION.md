# Documentación del Sistema - Repuestos Hamilton

## 1. Visión General
El **Sistema Web de Repuestos Hamilton** es una aplicación de página única (SPA) diseñada para la gestión de inventario, punto de venta (POS) y control de caja de una tienda de repuestos automotrices. Su diseño se enfoca en la velocidad de operación (densidad de información, accesos rápidos) y la seguridad de los datos.

## 2. Arquitectura y Tecnologías
El sistema está construido con una arquitectura "Serverless" moderna, eliminando la necesidad de un servidor backend tradicional.

*   **Frontend (Interfaz de Usuario):**
    *   **HTML5 & CSS3:** Estructura y diseño base.
    *   **JavaScript (ES6 Modules):** Lógica de negocio modular y estado de la aplicación.
    *   **Bootstrap 5.3:** Framework CSS responsivo y sistema de grillas.
    *   **SweetAlert2:** Para alertas y modales interactivos estilizados.
    *   **SheetJS (xlsx):** Para importación y exportación de reportes en Excel.
*   **Backend & Base de Datos (BaaS):**
    *   **Supabase:** Plataforma como servicio que provee base de datos PostgreSQL en tiempo real y APIs autogeneradas.
    *   **Supabase Auth:** Gestión de autenticación y sesiones de usuarios segura.
*   **Despliegue (Hosting):**
    *   **Vercel:** Plataforma de alojamiento para sitios web estáticos (pre-configurada con variables de entorno para protección de llaves).

## 3. Módulos del Sistema

### 3.1. Autenticación y Accesos (`index.html`)
*   Sistema de inicio de sesión seguro vinculado a Supabase Auth.
*   Control de Roles: **Administrador** (acceso total) y **Cajero** (acceso restringido, no puede ver módulos del sistema ni gestionar usuarios).

### 3.2. Dashboard (`dashboard.html`)
*   Vista gerencial con KPIs (Indicadores Clave de Rendimiento).
*   Métricas de ventas del día, productos bajos en stock y actividad reciente.

### 3.3. Inventario (`inventory.html`)
*   Gestión completa de productos (Crear, Editar).
*   **Manejo de Stock y Precios:** Soporte para 3 niveles de precios (Precio Compra, Precio Límite, Precio Venta).
*   **Filtros:** Búsqueda en tiempo real por código, descripción o sustituto, además de filtrado por Marca y Estado.
*   **Módulo de Bajas:** Permite dar de baja un producto defectuoso o caducado, registrando el motivo y la fecha exacta.
*   **Importación Masiva:** Permite poblar la base de datos subiendo una plantilla de Excel.
*   **Exportación:** Descarga del inventario actual filtrado a Excel (`.xlsx`) con formato corporativo.

### 3.4. Punto de Venta / Notas de Venta (`sales.html`)
*   Interfaz optimizada para el registro rápido de ventas.
*   Buscador dinámico de productos y cálculo automático de subtotales y totales.
*   **Métodos de Pago:** Soporta cobros en Efectivo, QR o Mixto (distribución de montos entre Efectivo y QR en una misma venta).
*   **Impresión:** Generación automática de comprobantes/recibos adaptados para impresoras térmicas (formato denso y sin márgenes del navegador).

### 3.5. Cierre de Caja (`caja.html`)
*   Consolidación diaria de ingresos y egresos.
*   Desglose automático por método de pago (Efectivo y QR) según los registros de ventas del día.
*   Exportación del resumen de caja a Excel.

### 3.6. Usuarios (`users.html`) - *Solo Admin*
*   Gestión de perfiles del personal (nombre, apellido, CI, correo y rol).
*   Integración con la creación de cuentas de acceso en Supabase Auth directamente desde la interfaz.

### 3.7. Historial de Movimientos (Logs) (`logs.html`) - *Solo Admin*
*   Registro de auditoría (Audit Trail) automático e inmutable.
*   Registra quién, cuándo y qué acción realizó (ej. "Dennys registró una venta de Bs395.00").
*   Paginación dinámica (10 ítems por página) y exportación de reportes a Excel con estilos aplicados.

## 4. Estructura de Base de Datos (Supabase PostgreSQL)
El sistema requiere la siguiente estructura base de tablas para operar:

1.  **`users`**: Perfiles de usuarios (`id`, `nombre`, `apellido`, `ci`, `email`, `role`).
2.  **`products`**: Catálogo (`id`, `codigo`, `sust`, `marca`, `descripcion`, `p1`, `p2`, `p3`, `stock`, `estado`, `motivoBaja`, `fechaBaja`).
3.  **`sales`**: Cabecera de ventas (`id`, `total`, `payment_method`, `cash_amount`, `qr_amount`, `client_name`, `timestamp`, `user_email`).
4.  **`sale_items`**: Detalle de productos vendidos (`id`, `sale_id`, `codigo`, `descripcion`, `price`, `quantity`, `subtotal`).
5.  **`logs`**: Auditoría del sistema (`id`, `timestamp`, `email`, `module`, `action`, `details`).

## 5. Mantenimiento y Despliegue
*   El código fuente se gestiona vía **Git/GitHub**.
*   Las actualizaciones de interfaz se reflejan en **Vercel** automáticamente tras hacer un "push" a la rama `main`.
*   Las variables de entorno (`SUPABASE_URL`, `SUPABASE_KEY`) deben mantenerse configuradas en el panel de Vercel (Project Settings > Environment Variables) utilizando el script `build.js` configurado como *Build Command*.
