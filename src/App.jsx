import React, { useEffect, useMemo, useState } from 'react';
import DeckGL, { ScatterplotLayer, HeatmapLayer } from 'deck.gl';
import Map from 'react-map-gl/maplibre';
import { createClient } from '@supabase/supabase-js';

// Datos públicos del proyecto Supabase (la clave "anon" es pública y la tabla solo permite lectura).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://evwffhsureoydcntnoim.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2d2ZmaHN1cmVveWRjbnRub2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTYyMzEsImV4cCI6MjEwOTMzMjIzMX0.0pZM-qxhT4CisACZ-IOPp9xgX00nhg3Z8kaUXRfMCmA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Una entrega está demorada si su tiempo (valor) supera su tiempo objetivo (tiempo_objetivo_min).
const objetivo = d => d.tiempo_objetivo_min ?? 60;
const demorada = d => d.valor != null && d.valor > objetivo(d);
const COLORES = { Entregado: [39, 174, 96], 'En camino': [41, 128, 185], Pendiente: [230, 126, 34] };
const MAPA_BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const VISTA_INICIAL = { longitude: -58.43, latitude: -34.615, zoom: 11.3, pitch: 0, bearing: 0 };

export default function App() {
  const [datos, setDatos] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [verPuntos, setVerPuntos] = useState(true);
  const [verCalor, setVerCalor] = useState(false);

  useEffect(() => {
    supabase
      .from('puntos')
      .select('id, nombre, categoria, latitud, longitud, valor, fecha, descripcion, tiempo_objetivo_min, zona')
      .then(({ data, error }) => {
        console.log('Datos recibidos de Supabase:', data, error);
        if (error) { setEstado('No se pudieron leer los datos de Supabase: ' + error.message + '. Revisá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.'); return; }
        setDatos(data); setEstado('ok');
      });
  }, []);

  const kpi = useMemo(() => {
    const n = datos.length;
    const conTiempo = datos.filter(d => d.valor != null);
    const prom = conTiempo.length ? conTiempo.reduce((s, d) => s + d.valor, 0) / conTiempo.length : 0;
    const demoradas = datos.filter(demorada).length;
    const abiertas = datos.filter(d => d.categoria !== 'Entregado').length;
    const porBarrio = {};
    conTiempo.forEach(d => { (porBarrio[d.zona] ||= []).push(d.valor); });
    const peor = Object.entries(porBarrio)
      .map(([b, v]) => [b, v.reduce((a, c) => a + c, 0) / v.length])
      .sort((a, b) => b[1] - a[1])[0];
    return { n, prom, demoradas, abiertas, peor };
  }, [datos]);

  const capas = [
    verCalor && new HeatmapLayer({
      id: 'calor', data: datos, getPosition: d => [d.longitud, d.latitud],
      getWeight: d => d.valor ?? 0, radiusPixels: 60, intensity: 1.2
    }),
    verPuntos && new ScatterplotLayer({
      id: 'entregas', data: datos, pickable: true,
      getPosition: d => [d.longitud, d.latitud], // deck.gl usa [LONGITUD, LATITUD]
      getRadius: d => 80 + (d.valor ?? 30) * 4, radiusUnits: 'meters', radiusMinPixels: 4,
      getFillColor: d => [...(COLORES[d.categoria] || [120, 120, 120]), 200],
      stroked: true, getLineColor: d => demorada(d) ? [192, 57, 43] : [255, 255, 255],
      lineWidthMinPixels: 1.5
    })
  ].filter(Boolean);

  const tooltip = ({ object }) => object && {
    html: `<b>${object.nombre}</b> (${object.id})<br/>Estado: ${object.categoria}` +
          `<br/>Tiempo de entrega: ${object.valor != null ? object.valor + ' min' : 'sin entregar'}` +
          `<br/>Objetivo: ${objetivo(object)} min · Zona: ${object.zona}` +
          (object.valor != null ? `<br/>${demorada(object) ? '⚠️ Demorada' : '✓ En tiempo'}` : ''),
    style: { fontSize: '13px', borderRadius: '8px', padding: '8px 10px' }
  };

  return (
    <div className="app">
      <header>
        <h1>Mapa de Entregas – Logística en CABA</h1>
        <p className="sub">PoC: Dataset → Supabase → React/Vite → deck.gl → Vercel · ¿En qué zonas existen mayores demoras?</p>
        <div className="kpis">
          <div className="kpi"><b>{kpi.n}</b><span>Entregas registradas</span></div>
          <div className="kpi"><b>{kpi.prom.toFixed(1)} min</b><span>Tiempo promedio (entregadas)</span></div>
          <div className="kpi alert"><b>{kpi.demoradas}</b><span>Entregas demoradas (superan el objetivo)</span></div>
          <div className="kpi"><b>{kpi.abiertas}</b><span>Pendientes o en camino</span></div>
          <div className="kpi alert"><b>{kpi.peor ? kpi.peor[0] : '–'}</b><span>Zona con mayor tiempo promedio{kpi.peor ? ` (${kpi.peor[1].toFixed(0)} min)` : ''}</span></div>
        </div>
      </header>
      <div className="mapwrap">
        {estado !== 'ok' && <div className="status">{estado === 'cargando' ? 'Cargando datos desde Supabase…' : estado}</div>}
        <div className="panel">
          <b>Capas</b>
          <label><input type="checkbox" checked={verPuntos} onChange={e => setVerPuntos(e.target.checked)} /> Puntos (ScatterplotLayer)</label>
          <label><input type="checkbox" checked={verCalor} onChange={e => setVerCalor(e.target.checked)} /> Mapa de calor de demoras</label>
          <h3>Estado del pedido</h3>
          {Object.entries(COLORES).map(([k, c]) => (
            <div key={k}><span className="dot" style={{ background: `rgb(${c})` }} />{k}</div>
          ))}
          <div><span className="dot" style={{ border: '2px solid rgb(192,57,43)' }} />Borde rojo: superó el objetivo</div>
          <div style={{ marginTop: 4, color: '#5b6573' }}>Tamaño = tiempo de entrega</div>
        </div>
        <DeckGL initialViewState={VISTA_INICIAL} controller={true} layers={capas} getTooltip={tooltip}>
          <Map mapStyle={MAPA_BASE} />
        </DeckGL>
      </div>
    </div>
  );
}
