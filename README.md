# 🎯 LEAD SCRAPER v3.0 - Puppeteer Edition

Scraper de leads **100% GRATIS** para Google Maps usando Puppeteer. Encuentra negocios con "puntos ciegos digitales" sin necesidad de API keys.

## ⚡ Características Principales

- 🆓 **Sin API Key** - Scraping directo de Google Maps con Puppeteer
- 🔍 **Búsqueda inteligente por zonas** - Subdivide ciudades grandes automáticamente
- 📊 **Lead Score** - Califica leads automáticamente para priorizar los mejores
- 🔄 **Streaming en tiempo real** - Ve los leads aparecer mientras se buscan
- 🚫 **Anti-duplicados** - No guarda leads que ya existen
- 📤 **Exportar CSV** - Descarga tus leads fácilmente
- 🧹 **Limpiar todo** - Borra todos los leads para empezar de cero

---

## 📊 Sistema de Lead Score (0-100 puntos)

El **Lead Score** califica automáticamente cada lead para que puedas priorizar los más prometedores.

### ¿Cómo se calcula?

| Criterio                | Puntos | Explicación                                         |
| ----------------------- | ------ | --------------------------------------------------- |
| **Sin website**         | +35    | El negocio NO tiene página web (máxima oportunidad) |
| **Solo redes sociales** | +20    | Tiene Instagram/Facebook pero no web propia         |
| **Rating 4.0+**         | +15    | Buena reputación, negocio establecido               |
| **50+ reseñas**         | +10    | Alto volumen de clientes                            |
| **Tiene teléfono**      | +10    | Fácil de contactar                                  |
| **Tiene email**         | +5     | Contacto directo disponible                         |
| **Tiene WhatsApp**      | +5     | Contacto moderno                                    |

### Interpretación del Score

| Score      | Significado       | Acción                   |
| ---------- | ----------------- | ------------------------ |
| **80-100** | 🔥 Lead caliente  | Contactar inmediatamente |
| **60-79**  | ⭐ Muy bueno      | Alta prioridad           |
| **40-59**  | 👍 Prometedor     | Prioridad media          |
| **20-39**  | 📋 Regular        | Evaluar caso por caso    |
| **0-19**   | ⏳ Bajo potencial | Baja prioridad           |

### Ejemplo práctico

```
"Pizzería Don Mario" - Score: 85
├── Sin website: +35
├── Solo Instagram: +20
├── Rating 4.6: +15
├── 127 reseñas: +10
└── Tiene teléfono: +5

→ Lead ideal: Negocio establecido sin presencia web profesional
```

---

## 🗺️ Búsqueda Inteligente por Zonas

Cuando buscás en ciudades grandes, el sistema automáticamente subdivide en barrios para obtener más resultados.

### Ciudades soportadas

| País         | Ciudades                                                         |
| ------------ | ---------------------------------------------------------------- |
| 🇦🇷 Argentina | Buenos Aires (15 barrios), Zona Norte, Córdoba, Rosario, Mendoza |
| 🇲🇽 México    | CDMX (12 colonias), Guadalajara, Monterrey                       |
| 🇪🇸 España    | Madrid, Barcelona                                                |
| 🇨🇴 Colombia  | Bogotá                                                           |
| 🇨🇱 Chile     | Santiago                                                         |
| 🇵🇪 Perú      | Lima                                                             |

### Ejemplo

Buscar "cafetería" en "Buenos Aires" automáticamente busca en:

- Palermo, Belgrano, Recoleta, Caballito, Villa Crespo...
- Resultado: 50-100+ leads en vez de ~20

---

## 🛠️ Pre-requisitos

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 📦 Instalación

### 1. Configurar Docker

```bash
# Levantar PostgreSQL y Redis
docker-compose up -d

# Verificar contenedores
docker ps
```

### 2. Configurar Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### 3. Configurar Frontend

```bash
cd frontend
npm install
```

## 🚀 Iniciar la Aplicación

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

Abrir en navegador: **http://localhost:3000**

---

## 🖥️ Uso de la Interfaz

### Buscar Leads

1. Escribir **keyword** (ej: "restaurante", "peluquería")
2. Escribir **ubicación** (ej: "Palermo, Buenos Aires")
3. Seleccionar **cantidad** de resultados (5, 10, 15, 30, 50)
4. Click en **Buscar**

### Barra de Progreso

Durante la búsqueda verás:

- Zona actual siendo buscada
- Cantidad de leads encontrados
- Progreso de zonas (si es búsqueda multi-zona)

### Botón "Repetir"

Después de una búsqueda, aparece el botón **Repetir** para volver a buscar con los mismos parámetros (útil si refrescás la página).

### Filtros

- **Todos**: Muestra todos los leads
- **Sin Web**: Solo negocios sin página web (máxima oportunidad)
- **Score 70+**: Solo leads de alta calidad
- **Pendientes/Contactados**: Por estado de seguimiento

### Ordenamiento

Click en las columnas **Negocio**, **Rating** o **Score** para ordenar.

### Exportar

Click en **Exportar CSV** para descargar todos los leads.

### Limpiar Todo

Click en **Limpiar Todo** para borrar todos los leads y empezar de cero (útil cuando terminás de trabajar una zona).

---

## 📁 Estructura del Proyecto

```
axxen-scrapper/
├── backend/
│   ├── src/
│   │   ├── server.ts                 # API Express
│   │   └── services/
│   │       ├── googleMapsScraper.ts  # Puppeteer scraping
│   │       ├── placesService.ts      # Lógica de negocio
│   │       ├── zoneService.ts        # Subdivisión de zonas
│   │       ├── enrichmentService.ts  # Análisis de websites
│   │       ├── antiDetection.ts      # Anti-bloqueo
│   │       └── logger.ts             # Logging
│   └── prisma/
│       └── schema.prisma             # Modelo de datos
├── frontend/
│   └── src/
│       ├── App.tsx                   # React app
│       └── main.tsx                  # Entry point
├── docker-compose.yml                # PostgreSQL + Redis
└── README.md                         # Esta documentación
```

---

## 🔧 API Endpoints

| Método | Endpoint             | Descripción                  |
| ------ | -------------------- | ---------------------------- |
| GET    | `/api/scrape/stream` | Scraping con streaming (SSE) |
| POST   | `/api/scrape`        | Scraping tradicional         |
| GET    | `/api/leads`         | Obtener leads (paginado)     |
| GET    | `/api/stats`         | Estadísticas del sistema     |
| GET    | `/api/export`        | Exportar leads a CSV         |
| PATCH  | `/api/leads/:id`     | Actualizar estado de lead    |
| DELETE | `/api/leads/:id`     | Eliminar un lead             |
| DELETE | `/api/leads`         | Eliminar TODOS los leads     |

### Parámetros de `/api/leads`

| Parámetro   | Tipo    | Descripción                                             |
| ----------- | ------- | ------------------------------------------------------- |
| `page`      | number  | Número de página (default: 1)                           |
| `limit`     | number  | Leads por página (default: 50)                          |
| `sortBy`    | string  | Campo para ordenar (leadScore, googleRating, createdAt) |
| `sortOrder` | string  | Dirección (asc, desc)                                   |
| `noWebsite` | boolean | Filtrar solo sin web                                    |
| `minScore`  | number  | Score mínimo                                            |
| `status`    | string  | Estado de outreach                                      |
| `search`    | string  | Búsqueda por texto                                      |

---

## 📝 Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://scraper:scraper_local_2024@localhost:5432/lead_scraper

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Puerto del servidor
PORT=3001
```

---

## ⚠️ Notas sobre Seguridad y Límites

### Riesgo de bloqueo

El scraping se hace desde tu IP local. Para minimizar riesgos:

| Uso                  | Riesgo               |
| -------------------- | -------------------- |
| 10-20 leads/búsqueda | ✅ Muy seguro        |
| 50-100 leads/día     | ⚠️ Seguro con pausas |
| 200+ leads/día       | ❌ Posible bloqueo   |

### Protecciones implementadas

- Rotación de User-Agent
- Delays humanizados (3-5 segundos)
- Movimientos de mouse aleatorios
- Scroll natural

---

## 📄 Licencia

MIT
