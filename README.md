# 🐾 Huellas Sin Hogar — Portal del Staff

Sistema web centralizado para la gestión operativa integral de refugios y centros de rescate animal.

---

## 📌 Contexto y Problemática

En muchos refugios de animales, la operación diaria depende de registros manuales en cuadernos de papel, hojas de cálculo en Excel dispersas y coordinación informal por grupos de mensajería (WhatsApp). Este esquema fragmentado genera:

* **Pérdida de historial clínico y conductual** de los animales albergados.
* **Duplicidad de solicitudes de adopción** y falta de alertas sobre postulantes riesgosos o con devoluciones previas.
* **Seguimientos post-adopción inconsistentes**, que quedan solo en la memoria de quien gestionó el caso.
* **Turnos de voluntariado descubiertos o duplicados** debido a desorganización en las franjas horarias.
* **Desconocimiento del aforo real** de caniles y gateras para coordinar rescates o derivaciones con protectoras aliadas.
* **Falta de control preventivo del inventario** de medicamentos y alimentos críticos.

**Huellas Sin Hogar** centraliza todos estos flujos en una interfaz web ágil, intuitiva y accesible para el personal administrativo, veterinarios y voluntarios.

---

## 🚀 Características y Módulos Principales

### 1. 📊 Dashboard Operativo (Panel Principal)
* Indicadores clave en tiempo real: total de animales albergados, porcentaje de capacidad, adopciones completadas en el mes, vacunas pendientes críticas y voluntarios activos en el turno.
* Visualizador rápido de aforo para caniles (perros) y gateras (felinos).
* Feed de actividades y eventos recientes en el refugio.
* Acciones rápidas para registro inmediato de animales, insumos y citas médicas.

### 2. 🐶 Registro y Ficha Individual del Animal
* Catálogo de animales con filtros por nombre, estado de salud (🟢 Normal, 🟡 Especial, 🔴 Crítico) y especie (Perro / Gato).
* Ficha individual desplegable con:
  * Identificación por microchip, edad estimada, peso, sexo y raza.
  * Historial de vacunación con estatus dinámico (al día, vencida o refuerzo requerido).
  * Estado reproductivo (esterilización) y descripción de comportamiento.
  * Notas clínicas del día (dietas médicas, restricciones y observaciones).
  * Soporte para carga y visualización de fotografía del animal.

### 3. 📋 Gestión de Adopciones y Trazabilidad Post-Adopción
* Registro de solicitantes con validación automática por RUT/Identificación para evitar solicitudes duplicadas.
* Detección preventiva de postulantes con antecedentes de devoluciones previas.
* Pipeline de estados del proceso: `Solicitud recibida` ➔ `En revisión` ➔ `Visita agendada` ➔ `Visita al hogar` ➔ `Seguimiento 15d` ➔ `Seguimiento 30d` ➔ `Adoptado` / `Devuelto`.

### 4. 🚪 Control de Caniles y Espacios Físicos
* Mapeo visual del estado de cada canil: **Libre**, **Ocupado** o en **Cuarentena médica**.
* Asociación directa del animal alojado con acceso visual a su ficha.
* Contadores de disponibilidad inmediata para planificar rescates o traslados.

### 5. 📦 Inventario de Insumos y Alimentos
* Control de stock clasificado por categorías (Alimento, Medicamento, Higiene, Equipamiento).
* Detección automática de stock crítico según el mínimo operacional definido para cada producto.

### 6. 🤝 Horarios y Directorio de Voluntarios
* Matriz semanal de turnos dividida en franjas (Mañana: 08:00 - 13:00 / Tarde: 14:00 - 19:00).
* Asignación por áreas funcionales (Paseos, Limpieza, Atención Veterinaria, Alimentación).
* Directorio de voluntarios con datos de contacto y disponibilidad declarada.

### 7. 🩺 Salud, Vacunación y Agenda Clínica
* Monitor de alertas para vacunas urgentes y refuerzos por vencer.
* Agenda de citas veterinarias con asignación de profesional responsable y motivo de consulta.

---

## 🛠️ Tecnologías Utilizadas

* **HTML5:** Marcado semántico y estructura modular para Single Page Application (SPA).
* **CSS3 nativo:** 
  * Tokens de diseño mediante Custom Properties (`:root`).
  * Maquetación responsiva con CSS Grid y Flexbox.
  * Adaptabilidad completa para resoluciones desktop, tablet y móviles.
* **JavaScript (Vanilla / ES6+):** 
  * Manejo reactivo del estado local del sistema (`state`).
  * Manipulación del DOM sin dependencias pesadas.
  * Lectura de imágenes en local mediante `FileReader API`.
* **Iconografía:** [Lucide Icons](https://lucide.dev/) (CDN liviano).
* **Tipografía:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (Google Fonts).

---

## 📂 Estructura del Repositorio

```text
├── index.html        # Aplicación completa (interfaz, estilos y lógica)
├── README.md         # Documentación del proyecto
```

---

## 💻 Instalación y Uso

Al tratarse de una solución ligera basada en tecnologías web estándar, no requiere compilación previa ni gestores de paquetes:

1. Clona este repositorio o descarga los archivos:
   ```bash
   git clone https://github.com/tu-usuario/huellas-sin-hogar.git
   cd huellas-sin-hogar
   ```
2. Abre el archivo `index.html` directamente en tu navegador web preferido:
   * Doble clic en `index.html`, o
   * Utilizando una extensión de servidor local como **Live Server** en Visual Studio Code.

---

## 🎥 Video de Presentación de la Propuesta

Puedes revisar la cápsula en video con la explicación detallada de la propuesta en el siguiente enlace:

🔗 [Ver Video de la Propuesta (Google Drive)](https://drive.google.com/file/d/1ZmRVmj-mM6MQ958F-ukudcxcVtj2DUZy/view?usp=drive_link)

---

## 👥 Integrantes del Equipo

* **Renato Acosta**
* **Bruno Aldana**
* **Benjamín Jara**
* **Martin Romero**
* **Cristóbal Soto**
