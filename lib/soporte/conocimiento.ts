import "server-only";

/**
 * Guías de uso del sistema que recibe el asistente de soporte, una por rol.
 *
 * REGLA: aquí solo va CÓMO usar el sistema (menús, pasos, condiciones, estados).
 * Nunca incluir fórmulas, tasas, factores, nivelación, comisiones (en ningún rol),
 * datos reales (clientes, canales, aseguradoras, montos) ni nombres de tablas o campos.
 * Lo que el modelo no recibe, no lo puede revelar.
 */

export type SupportRole = "insurer" | "channel";

const COMUN = `
## Generalidades de la plataforma Kuantiq
- Plataforma de seguro vehicular con pago en cuotas mensuales fijas.
- El menú lateral izquierdo se puede contraer con el botón de flecha. En el celular el menú se abre con el botón de la parte superior.
- "Cerrar sesión" está al pie del menú lateral y en la barra superior.
- Todos los importes se muestran en dólares (USD). Las fechas usan la hora de Ecuador.
- Los listados largos tienen paginación con "Anterior" y "Siguiente", y la mayoría tiene filtros con "Aplicar"/"Buscar" y "Limpiar".
- Las descargas a Excel respetan los filtros que estén aplicados en la pantalla.
- Los formularios muestran los errores debajo de cada campo; si algo falla, el sistema indica que "no se guardó ningún dato".
- Las cargas masivas se guardan "todo o nada": si una fila tiene errores, no se guarda ninguna hasta corregirla o eliminarla.
`;

const ASEGURADORA = `
## Rol: Administrador de aseguradora (menú "Panel de aseguradora")

### Resumen (menú "Resumen")
- Muestra producción, cobranza y vencimientos de todos los canales y productos de la aseguradora.
- Filtros: período (rangos rápidos o personalizado), canal y productos. Pulsa "Aplicar" para actualizar o "Limpiar" para quitar filtros.
- Secciones: indicadores del período, órdenes pendientes por emitir, cobranza (recaudado, por cobrar, vencido/mora, efectividad de cobro), antigüedad de la mora, cobranza por canal, producción por producto, marcas más aseguradas y vencimientos de los próximos 12 meses.
- Recaudado y efectividad corresponden al período elegido; por cobrar y mora se calculan a la fecha de hoy.
- "Descargar Excel" exporta el resumen con los filtros aplicados.

### Canales (menú "Canales")
- Para crear un canal: abre "Nuevo canal", completa Nombre (mínimo 2 caracteres) y opcionalmente Descripción, RUC, Teléfono, Dirección y Persona de contacto, y pulsa "Guardar".
- Condiciones: el RUC debe tener 13 dígitos y terminar en 001; el teléfono solo admite números, espacios, guiones y "+"; no puede haber dos canales con el mismo nombre.
- Con "Guardar y crear producto" se guarda el canal y se pasa directo a crear su primer producto.
- Cada canal se puede editar desde su tarjeta y "Activar"/"Desactivar" con el botón correspondiente.

### Productos (menú "Productos")
- Para crear un producto: abre "Nuevo producto", indica Nombre del producto, Canal y Ramo habilitado, marca si "Aplica a todas las ciudades" y pulsa "Guardar".
- Cada producto pertenece a un solo canal. Puedes filtrar la lista por canal.
- "Configurar" abre la parametrización del producto; "Activar"/"Desactivar" controla si el canal puede usarlo.
- Parametrización (secciones con menú "Ir a una sección"): Tasas e impuestos, Años y depreciación, Factores de riesgo, Matriz tarifaria y Deducibles por pérdidas. Cada sección tiene su formulario y botón "Guardar".
- Los porcentajes se ingresan como decimales: por ejemplo, 0.035 equivale a 3,5 %.
- Los factores de riesgo (marcas y modelos, ciudades, género, uso, color, estado civil, rangos de edad y monto asegurado) se clasifican como Alto (1), Moderado (2) o Bajo (3).
- En rangos de edad o monto, dejar vacío el "hasta" significa "sin límite".
- Si un canal no puede registrar órdenes con un producto, revisa que el producto esté activo y que tenga coberturas activas.
- Los cambios de parametrización se aplican a las nuevas órdenes y a los recálculos posteriores.

### Usuarios de canal (menú "Usuarios de canal")
- Para crear un agente: abre "Nuevo usuario", completa Nombre, Correo y Canal, define una Contraseña temporal de al menos 10 caracteres y pulsa "Guardar".
- Solo puedes asignar canales de tu propia aseguradora. El correo no puede estar registrado previamente.
- Cada usuario se puede editar y "Activar"/"Desactivar". Un usuario desactivado no puede ingresar.

### Pendientes de emisión (menú "Pendientes de emisión")
- Lista las órdenes de emisión registradas por los canales que aún no tienen póliza. Filtros: canal, producto, desde y hasta.
- Por cada orden puedes: "Ver cálculo" (detalle del cronograma), "Editar y recalcular" y "Emitir".
- Para emitir: escribe el "N.º de póliza" y pulsa "Emitir". Se genera la póliza y su cronograma de cobranza.
- Si la orden muestra el aviso de que falta un cálculo, usa "Editar y recalcular" antes de emitir.
- "Editar y recalcular" permite ajustar producto, vehículo, coberturas, años y fecha de inicio de vigencia; al confirmar "Recalcular cotización" se reemplaza el cronograma con la configuración vigente del producto y la orden sigue pendiente.
- También muestra el estado de la inspección de cada orden (sin inspección, en progreso, analizando IA, aprobada o rechazada) con acceso a su revisión.
- La sección inferior permite buscar pólizas emitidas por cédula, nombre del cliente o placa.

### Pólizas emitidas (menú "Pólizas emitidas")
- Consulta pólizas por rango de emisión, canal, producto, estado (vigente, cancelada, vencida) y búsqueda por texto.
- "Ver detalle" muestra las condiciones de la póliza, su cronograma y los pagos.
- "Descargar Excel" exporta el listado filtrado.
- Si la fecha "desde" es posterior a la fecha "hasta", el sistema muestra las emisiones del año en curso.

### Vencimientos (menú "Vencimientos")
- Pólizas cuyo fin de vigencia cae en el rango elegido, para gestionar la renovación. Rangos rápidos: próximos 30, 60 o 90 días, o vencidas en los últimos 90 días, además de fechas personalizadas.
- Muestra cuántas vencen en 15 días o menos, de 16 a 30 días, las ya vencidas y las que tienen cuotas vencidas (revisar antes de renovar).
- No incluye pólizas canceladas. "Descargar Excel" exporta el listado.

### Pagos (menú "Pagos")
- Muestra los pagos de cuotas que registraron los canales. Filtros: pago desde/hasta, canal, productos, conciliación y método.
- Conciliar: selecciona los pagos (o todos los del filtro) cuando confirmes que recibiste el dinero y usa la acción de conciliar; también puedes quitar la conciliación.
- La selección se conserva al cambiar de página. Máximo 10.000 pagos por operación; si se supera, reduce el rango o los filtros.
- "Descargar Excel" exporta los pagos filtrados.

### Inspecciones (menú "Inspecciones")
- Lista las inspecciones fotográficas completadas. Filtros: rango (diario, semanal, mensual, todo o fechas), revisión (pendiente, aprobada, rechazada) y placa.
- Al abrir una inspección verás pestañas: Detalles del coche, Daños, Imágenes originales e Imágenes IA, más la ubicación de la captura si el usuario la permitió.
- El técnico puede escribir observaciones por foto y ajustar la gravedad de cada daño detectado por la IA; luego guarda los cambios.
- Para dictaminar: "Aprobar inspección" o "Rechazar inspección", escribe el motivo (mínimo 3 caracteres) y confirma.
`;

const CANAL = `
## Rol: Usuario de canal (agente comercial)

### Resumen (menú "Resumen")
- Muestra la producción del canal: vehículos emitidos, clientes, órdenes pendientes por emitir, producción por producto, marcas más aseguradas y vencimientos de los próximos 12 meses.
- Filtro de período con rangos rápidos o personalizado. "Descargar Excel" exporta el resumen.

### Órdenes de Emisión (menú "Órdenes de Emisión")
- Lista las órdenes pendientes (aún sin póliza). Se puede buscar por cliente, cédula, placa, marca, modelo, producto o aseguradora.
- Para registrar: botón "Registrar seguros" y elige "Ingreso manual" o "Carga masiva desde Excel".
- Ingreso manual (Nueva Orden de Emisión):
  1. Busca un cliente existente (por nombre, o por cédula/RUC/correo exacto) o crea un "Cliente nuevo". Si el cliente existe en la plataforma pero no está vinculado a tu canal, usa "Vincular y cotizar".
  2. Al crear un cliente: Nombres completos, Cédula o RUC (al escribir la cédula el sistema intenta completar los datos; si no encuentra, ingrésalos manualmente), Correo, Teléfono, Ciudad, Fecha de nacimiento, Género, Estado civil y Dirección opcional.
  3. El cliente debe tener su perfil completo (cédula, teléfono, ciudad, nacimiento, género y estado civil) para poder cotizar.
  4. Pasos del asistente: Producto → Vehículo (tipo, marca, modelo, color, valor asegurado, estado nuevo/usado, uso particular/comercial/corporativo, placa) → Protección (años de vigencia, fecha de inicio de vigencia y coberturas; al menos una cobertura) → Confirmar → "Calcular Orden de Emisión".
  5. La fecha de inicio de vigencia puede ser desde hoy hasta 90 días en el futuro.
  6. Después se muestra el certificado de cobertura: elige enviarlo por Correo electrónico o WhatsApp y pulsa "Enviar y registrar". La orden solo se registra si el certificado se envía correctamente.
- Carga masiva: elige el producto (todo el archivo usa el mismo producto y coberturas), "Descargar plantilla", llénala y "Subir plantilla". Máximo 100 filas, formato .xlsx, hasta 5 MB. Revisa cada fila, corrige o elimina las que tengan errores y pulsa "Guardar y enviar". Se envía el certificado por correo a cada cliente; no cierres la página durante el proceso. Si un envío falla, no se guarda ninguna orden y se indica a quién ya le llegó el correo.
- Editar una orden pendiente: abre "Ver detalle" → "Editar orden". Puedes corregir datos del titular, producto, coberturas, vehículo, vigencia e inicio; al pulsar "Guardar y generar certificado" se recalcula la cuota y se envía el certificado actualizado (conserva su número).
- Eliminar: botón "Eliminar" → "Eliminar definitivamente". Borra la orden con su cronograma y su inspección; no se puede deshacer.
- La emisión de la póliza la realiza la aseguradora.

### Inspección con IA (desde el detalle de la orden → "Inspección")
- Selecciona la carrocería del vehículo y captura cada toma siguiendo la guía; se puede usar la cámara del celular, la webcam o subir una imagen.
- Puedes "Repetir" o "Eliminar foto". La ubicación es opcional.
- Pulsa "Guardar y analizar" para que la IA revise los daños. Cambiar la carrocería puede eliminar fotos que ya no apliquen.
- La aprobación o rechazo de la inspección la hace la aseguradora.

### Clientes (menú "Clientes")
- Busca la cartera por nombre, cédula o RUC, placa, marca, modelo, producto o aseguradora.
- En cada orden puedes "Ver detalle", "Ver certificado" y "Reenviar certificado" por correo o WhatsApp (requiere correo registrado o un teléfono válido para WhatsApp).

### Pagos (menú "Pagos")
- Muestra las cuotas por mes de vencimiento. Filtros: vencimiento desde/hasta, productos y estado (por cobrar, pendientes, vencidos, pagados, todos).
- Para registrar pagos: selecciona una o varias cuotas (o todas las del filtro), pulsa "Registrar pagos", indica la Fecha de pago, el Método (transferencia, efectivo, depósito, cheque u otro) y la Referencia opcional, y pulsa "Confirmar pagos".
- Condiciones: las cuotas se pagan en orden (primero la cuota anterior de la misma póliza); desmarcar una cuota desmarca las siguientes de esa póliza; la fecha de pago no puede ser futura ni anterior a la emisión de la póliza; máximo 10.000 cuotas por operación.

### Cancelaciones (menú "Cancelaciones")
- Botón "Registrar cancelación" → "Cancelación individual" o "Carga masiva desde Excel".
- Individual: busca la póliza por cliente, cédula/RUC, placa o número de póliza (solo aparecen pólizas vigentes del canal). Elige el tipo:
  - Cancelación normal: elige el mes de cancelación y un motivo opcional (máx. 300 caracteres).
  - Pérdida total: indica la fecha del siniestro (no puede ser futura ni anterior a la emisión), número de reclamo opcional (máx. 60 caracteres) y motivo.
  - Revisa las cuotas que se cancelarán y confirma con "Sí, cancelar". No se puede deshacer.
- Condiciones: el mes de cancelación no puede ser anterior al mes de emisión ni estar fuera de la vigencia; las cuotas ya pagadas no se cancelan, así que se debe elegir un mes posterior a la última pagada; si todas están pagadas no hay nada que cancelar.
- Carga masiva: "Descargar plantilla", indica por póliza la cédula/RUC, la placa, el producto y el mes de cancelación, y súbela (máx. 100 filas, .xlsx, hasta 5 MB). Si alguna fila falla, no se cancela ninguna.
- El listado de cancelaciones se puede buscar por cliente, cédula, placa, póliza o producto.

### Tradicional (menú "Tradicional")
- Herramienta de demostración que compara el seguro tradicional anual con el modelo de cuota mensual fija. Modifica los valores y los resultados se actualizan al instante; no se guarda nada. "Restablecer valores de ejemplo" vuelve a los valores iniciales.

### Mi perfil (menú "Mi perfil")
- Muestra nombre, correo, aseguradora y canal. Solo el administrador de la aseguradora puede cambiar la asignación de aseguradora, canal o perfil.
`;

export function supportGuide(role: SupportRole) {
  return COMUN + (role === "insurer" ? ASEGURADORA : CANAL);
}
