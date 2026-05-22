const axios = require('axios');
const cheerio = require('cheerio');

// Valores de referencia si el scraping falla
const REFERENCIA = {
  precio_carga: 1_580_000,
  bolsa_ny: 225,
  tasa_cambio: 4_200,
};

const RANGOS = {
  carga: { min: 400_000, max: 6_000_000 },
  ny:    { min: 80,      max: 800 },
  tasa:  { min: 2_500,   max: 7_500 },
};

function limpiarNumero(str, min, max) {
  if (!str) return null;
  const limpio = str.replace(/[^\d,\.]/g, '').replace(',', '.');
  const num = parseFloat(limpio);
  if (!isNaN(num) && num >= min && num <= max) return num;
  return null;
}

async function scrapeCafe() {
  const resultado = {
    fuente: 'FNC',
    en_vivo: false,
    precio_carga: REFERENCIA.precio_carga,
    bolsa_ny: REFERENCIA.bolsa_ny,
    tasa_cambio: REFERENCIA.tasa_cambio,
    timestamp: new Date().toISOString(),
  };

  try {
    const { data } = await axios.get(
      'https://federaciondecafeteros.org/wp/estadisticas-cafeteras/',
      {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PreciosAgroBot/1.0)',
          'Accept-Language': 'es-CO,es;q=0.9',
        },
      }
    );

    const $ = cheerio.load(data);

    // Buscar precio interno en el HTML
    let precioCarga = null;
    let bolsaNY = null;
    let tasa = null;

    $('*').each((i, el) => {
      const texto = $(el).text();

      if (!precioCarga) {
        const m = texto.match(/precio interno[^:]*:\s*\$?([\d\.\,\s]+)/i);
        if (m) precioCarga = limpiarNumero(m[1], RANGOS.carga.min, RANGOS.carga.max);
      }
      if (!bolsaNY) {
        const m = texto.match(/(?:bolsa|nueva york|ice)[^:]*:\s*([\d\.,]+)/i);
        if (m) bolsaNY = limpiarNumero(m[1], RANGOS.ny.min, RANGOS.ny.max);
      }
      if (!tasa) {
        const m = texto.match(/tasa[^:]*:\s*\$?([\d\.\,]+)/i);
        if (m) tasa = limpiarNumero(m[1], RANGOS.tasa.min, RANGOS.tasa.max);
      }
    });

    if (precioCarga) {
      resultado.precio_carga = precioCarga;
      resultado.en_vivo = true;
    }
    if (bolsaNY)  resultado.bolsa_ny     = bolsaNY;
    if (tasa)     resultado.tasa_cambio  = tasa;

  } catch (err) {
    resultado.error = err.message;
  }

  // Derivados
  resultado.precio_kg     = Math.round(resultado.precio_carga / 125);
  resultado.precio_arroba = Math.round(resultado.precio_carga / 125 * 12.5);
  resultado.semaforo      = getSemaforoCafe(resultado.precio_carga);

  return resultado;
}

function getSemaforoCafe(precioCarga) {
  if (precioCarga >= 1_700_000) return 'alto';
  if (precioCarga >= 1_200_000) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCafe };
