const axios   = require('axios');
const cheerio = require('cheerio');

// Diferenciales logísticos fijos por ciudad (fuente: PDF FNC, no cambian)
const DIFERENCIAL_CIUDAD = {
  'ARMENIA':      500,
  'BOGOTÁ':      -750,
  'BUCARAMANGA': -1_125,
  'BUGA':         1_250,
  'CHINCHINÁ':    375,
  'CÚCUTA':      -1_625,
  'IBAGUÉ':      -375,
  'MANIZALES':    375,
  'MEDELLÍN':    -375,
  'NEIVA':       -1_250,
  'PAMPLONA':   -1_500,
  'PASTO':      -1_500,
  'PEREIRA':      375,
  'POPAYÁN':      625,
  'SANTA MARTA':  2_125,
  'VALLEDUPAR':  -250,
};

// Tabla física FR (kg excelso y pasilla por carga de 125kg)
const TABLA_FR = {
  88:  { excelso: 99.43, pasilla: 2.13 },
  89:  { excelso: 98.31, pasilla: 4.20 },
  90:  { excelso: 97.22, pasilla: 4.94 },
  91:  { excelso: 96.15, pasilla: 5.55 },
  92:  { excelso: 95.11, pasilla: 6.45 },
  93:  { excelso: 94.09, pasilla: 7.19 },
  94:  { excelso: 93.09, pasilla: 8.16 },
  95:  { excelso: 92.11, pasilla: 8.93 },
  96:  { excelso: 91.15, pasilla: 9.60 },
  97:  { excelso: 90.21, pasilla: 10.52 },
  98:  { excelso: 89.29, pasilla: 11.25 },
  99:  { excelso: 88.38, pasilla: 12.16 },
  100: { excelso: 87.50, pasilla: 12.81 },
};

const PASILLA_COP_KG = 10_000; // fijo del PDF

// ── Parsear número colombiano  "$2.060.000" o "3.554,50" ────────────────────
function parseCOP(str) {
  // Formato: puntos como miles, coma como decimal
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

// ── Calcular precio por FR dado precio excelso/kg ───────────────────────────
function calcularFR(precioExcelsoKg, fr) {
  const { excelso, pasilla } = TABLA_FR[fr];
  const valorExcelso = Math.round(precioExcelsoKg * excelso);
  const valorPasilla = Math.round(PASILLA_COP_KG  * pasilla);
  const precioCarga  = valorExcelso + valorPasilla;
  return {
    fr,
    precio_carga:  precioCarga,
    precio_kg:     Math.round(precioCarga / 125),
    precio_arroba: Math.round(precioCarga / 10),
    valor_excelso: valorExcelso,
    valor_pasilla: valorPasilla,
  };
}

// ── Scraper principal ────────────────────────────────────────────────────────
async function scrapeCafe() {
  const resultado = {
    fuente:    'FNC - Federación Nacional de Cafeteros',
    url:       'https://federaciondecafeteros.org/transparencia-fepc/',
    en_vivo:   false,
    timestamp: new Date().toISOString(),
  };

  // ── 1. Scraping HTML de la FNC (precio oficial del día) ───────────────────
  try {
    const { data: html } = await axios.get(
      'https://federaciondecafeteros.org/transparencia-fepc/',
      { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    const $ = cheerio.load(html);
    const texto = $('body').text();

    // Precio interno de referencia: $2.060.000
    const mPrecio = texto.match(/Precio interno de referencia:\s*\$([\d.]+)/);
    // Bolsa de NY: $260,60
    const mBolsa  = texto.match(/Bolsa de NY:\s*\$([\d.,]+)/);
    // Tasa de cambio: 3.554,50
    const mTasa   = texto.match(/Tasa de cambio:\s*([\d.,]+)/);
    // Fecha: 2026-06-01
    const mFecha  = texto.match(/Fecha:\s*(\d{4}-\d{2}-\d{2})/);

    if (!mPrecio) throw new Error('No se encontró precio en el HTML');

    resultado.precio_carga  = parseCOP(mPrecio[1]);
    resultado.precio_kg     = Math.round(resultado.precio_carga / 125);
    resultado.precio_arroba = Math.round(resultado.precio_carga / 10);
    resultado.bolsa_ny      = mBolsa ? parseCOP(mBolsa[1]) : null;
    resultado.tasa_cambio   = mTasa  ? parseCOP(mTasa[1])  : null;
    resultado.fecha_precio  = mFecha ? mFecha[1] : null;
    resultado.en_vivo       = true;

    console.log('[FNC] ✅ Precio carga FR94:', resultado.precio_carga);
    console.log('[FNC] Bolsa NY:', resultado.bolsa_ny, '| TRM:', resultado.tasa_cambio);
    console.log('[FNC] Fecha:', resultado.fecha_precio);

  } catch (err) {
    console.error('[FNC HTML] ❌ Error:', err.message);
    // Fallback con últimos valores conocidos
    resultado.precio_carga  = 2_060_000;
    resultado.precio_kg     = 16_480;
    resultado.precio_arroba = 206_000;
    resultado.bolsa_ny      = 260.60;
    resultado.tasa_cambio   = 3_554.50;
    resultado.en_vivo       = false;
    resultado.error         = err.message;
  }

  // ── 2. Calcular precio excelso/kg para la tabla FR ────────────────────────
  // Despejamos: precioBase = precioExcelsoKg × 93.09 + 10000 × 8.16
  // → precioExcelsoKg = (precioBase - 81600) / 93.09
  const precioExcelsoKg = (resultado.precio_carga - (PASILLA_COP_KG * TABLA_FR[94].pasilla)) / TABLA_FR[94].excelso;

  // ── 3. Tabla completa FR 88-100 ───────────────────────────────────────────
  resultado.tabla_fr = Object.keys(TABLA_FR).map(fr =>
    calcularFR(precioExcelsoKg, parseInt(fr))
  );

  // ── 4. Precios por ciudad ─────────────────────────────────────────────────
  resultado.ciudades = Object.entries(DIFERENCIAL_CIUDAD).map(([ciudad, diff]) => {
    const carga = resultado.precio_carga + diff;
    return {
      ciudad,
      carga,
      kg:     Math.round(carga / 125),
      arroba: Math.round(carga / 10),
    };
  });

  // ── 5. Semáforo ───────────────────────────────────────────────────────────
  resultado.semaforo = getSemaforoCafe(resultado.precio_carga);

  return resultado;
}

function getSemaforoCafe(p) {
  if (p >= 2_500_000) return 'alto';
  if (p >= 1_800_000) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCafe };
