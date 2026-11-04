import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { createClient } from '@supabase/supabase-js';

// Datos de conexión a Supabase (la clave pública/anon puede ir en el front: la tabla solo permite lectura)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://evwffhsureoydcntnoim.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2d2ZmaHN1cmVveWRjbnRub2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTYyMzEsImV4cCI6MjEwOTMzMjIzMX0.0pZM-qxhT4CisACZ-IOPp9xgX00nhg3Z8kaUXRfMCmA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLORES = {
  Entregado: [22, 163, 74],
  'En camino': [37, 99, 235],
  Pendiente: [234, 179, 8],
};

const VISTA_INICIAL = { longitude: -58.43, latitude: -34.61, zoom: 11.3, pitch: 0, bearing: 0 };

const esDemorada = (p) => p.valor != null && p.valor > p.objetivo;

function App() {
  const [puntos, setPuntos] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [capa, setCapa] = useState('puntos');

  useEffect(() => {
    supabase
      .from('puntos')
      .select('id, nombre, categoria, latitud, longitud, valor, fecha, descripcion, zona, tiempo_objetivo_min')
      .then(({ data, error }) => {
        console.log('Datos recibidos de Supabase:', data, error);
        if (error) setError(error.message);
        else setPuntos(data.map((d) => ({ ...d, valor: d.valor == null ? null : Number(d.valor), objetivo: Number(d.tiempo_objetivo_min || 60) })));
        setCargando(false);
      });
  }, []);

  const kpis = useMemo(() => {
    const total = puntos.length;
    const conTiempo = puntos.filter((p) => p.valor != null);
    const promedio = conTiempo.length ? Math.round(conTiempo.reduce((s, p) => s + p.valor, 0) / conTiempo.length) : 0;
    const demoradas = puntos.filter(esDemorada).length;
    const entregados = puntos.filter((p) => p.categoria === 'Entregado').length;
    return { total, promedio, demoradas, entregados };
  }, [puntos]);

  const mapaBase = new TileLayer({
    id: 'mapa-base',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile;
      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    },
  });

  const capaPuntos = new ScatterplotLayer({
    id: 'entregas',
    data: puntos,
    getPosition: (d) => [d.longitud, d.latitud], // deck.gl usa [longitud, latitud]
    getRadius: (d) => (d.valor == null ? 180 : 60 + d.valor * 4),
    getFillColor: (d) => [...(COLORES[d.categoria] || [120, 120, 120]), 190],
    getLineColor: (d) => (esDemorada(d) ? [194, 65, 12] : [255, 255, 255]),
    getLineWidth: (d) => (esDemorada(d) ? 3 : 1),
    lineWidthUnits: 'pixels',
    stroked: true,
    pickable: true,
    radiusMinPixels: 4,
  });

  const capaCalor = new HeatmapLayer({
    id: 'calor-demoras',
    data: puntos.filter(esDemorada),
    getPosition: (d) => [d.longitud, d.latitud],
    getWeight: (d) => d.valor - d.objetivo,
    radiusPixels: 45,
  });

  const tooltip = ({ object }) =>
    object && {
      html: `<b>${object.nombre}</b><br/>Estado: ${object.categoria}<br/>Tiempo de entrega: ${object.valor == null ? 'sin entregar' : object.valor + ' min'} (objetivo ${object.objetivo} min)${esDemorada(object) ? ' <b style="color:#fb923c">DEMORADA</b>' : ''}<br/>Zona: ${object.zona}<br/>Fecha: ${object.fecha}`,
      style: { fontSize: '13px', borderRadius: '6px', padding: '8px 10px' },
    };

  return (
    <div className="app">
      <header>
        <h1>Mapa de Entregas – Buenos Aires</h1>
        <p className="sub">PoC Logística · ¿En qué zonas existen mayores demoras? · Datos desde Supabase</p>
        <div className="kpis">
          <div className="kpi"><b>{kpis.total}</b><span>Pedidos registrados</span></div>
          <div className="kpi"><b>{kpis.promedio} min</b><span>Tiempo promedio (entregados)</span></div>
          <div className="kpi alerta"><b>{kpis.demoradas}</b><span>Entregas demoradas (superan el objetivo)</span></div>
          <div className="kpi"><b>{kpis.entregados}</b><span>Pedidos entregados</span></div>
        </div>
        <div className="controls">
          <button className={capa === 'puntos' ? 'on' : ''} onClick={() => setCapa('puntos')}>Puntos</button>
          <button className={capa === 'calor' ? 'on' : ''} onClick={() => setCapa('calor')}>Mapa de calor (demoras)</button>
          <div className="legend">
            {Object.entries(COLORES).map(([k, c]) => (
              <span key={k}><i className="dot" style={{ background: `rgb(${c})` }} />{k}</span>
            ))}
            <span><i className="dot" style={{ border: '2px solid #c2410c' }} />Demorada</span>
          </div>
        </div>
      </header>
      <div className="map">
        <DeckGL
          initialViewState={VISTA_INICIAL}
          controller={true}
          layers={[mapaBase, capa === 'puntos' ? capaPuntos : capaCalor]}
          getTooltip={tooltip}
        />
        <div className="attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></div>
        {cargando && <div className="msg">Cargando datos desde Supabase…</div>}
        {error && <div className="msg">Error al leer Supabase: {error}</div>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
