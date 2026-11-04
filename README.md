# Mapa de Entregas – PoC Logística

Recorrido: **Dataset → Supabase → React/Vite → deck.gl → Vercel**

**Descripción del proyecto:**
Analizamos las demoras en las entregas de pedidos de la Ciudad de Buenos Aires.
Los datos son 60 entregas simuladas que guardamos en la tabla `puntos` de Supabase.
El mapa (deck.gl, con ScatterplotLayer) muestra cada pedido con un color según su estado (Pendiente, En camino o Entregado) y resalta los que superaron el tiempo objetivo.
Así se puede ver en qué zonas se concentran las demoras; también hay un mapa de calor (HeatmapLayer) que muestra cuánto se demoraron.
En una segunda versión agregaríamos datos reales, filtros por fecha y zona, y rutas de reparto.

## Ejecutar localmente
```
npm install
npm run dev
```
