const axios = require('axios');
const cheerio = require('cheerio');

const REFERENCIA = {
  usd_ton: 8_800,
  tasa_cambio: 4_200,
};

const RANGOS = {
  usd:  { min: 1_500, max: 20_000 },
  tasa: { min: 2_500, max: 7_500  },
};

function limpiarNumero(str, min, max) {
  if (!str) return null;
  const limpio = str.replace(/[^\d,\.]/g, '').replace(',', '.');
  const num = parseFloat(limpio);
  if (!isNaN(num) && num >= min && num <= max) return num;
  return null;
}

async function scrapeTasa() {
  try {
    const { data } = await axios.get(
      'https://dolar.wilkinsonpc.com.co/divisas/dolar.html',
      { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const $ = cheerio.load(data);
    let tasa = null;
    $('*').each((i, el) => {
      if (tasa) return;
      const m = $(el).text().match(/([\d]{1,2}\.[\d]{3}(?:[,\.]\d{2})?)/);
      if (m) tasa = limpiarNumero(m[1], RANGOS.tasa.min, RANGOS.tasa.max);
    });
    return tasa;
  } catch {
    return null;
  }
}

async function scrapeCacao() {
  const resultado = {
    fuente: 'ICE / FEPCACAO',
    en_vivo: false,
    precio_usd_ton: REFERENCIA.usd_ton,
    tasa_cambio: REFERENCIA.tasa_cambio,
    timestamp: new Date().toISOString(),
  };

  try {
    const { data } = await axios.get('https://www.fepcacao.com.co/', {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PreciosAgroBot/1.0)' },
    });

    const $ = cheerio.load(data);
    let usdTon = null;

    $('*').each((i, el) => {
      if (usdTon) return;
      const m = $(el).text().match(/USD[^\d]*([\d\.\,]+)/i);
      if (m) usdTon = limpiarNumero(m[1], RANGOS.usd.min, RANGOS.usd.max);
    });

    if (usdTon) {
      resultado.precio_usd_ton = usdTon;
      resultado.en_vivo = true;
    }
  } catch (err) {
    resultado.error_fepcacao = err.message;
  }

  // Tasa de cambio
  const tasa = await scrapeTasa();
  if (tasa) resultado.tasa_cambio = tasa;

  // Derivados
  resultado.precio_cop_ton = Math.round(resultado.precio_usd_ton * resultado.tasa_cambio);
  resultado.precio_cop_kg  = Math.round(resultado.precio_cop_ton / 1000);
  resultado.precio_arroba  = Math.round(resultado.precio_cop_kg * 12.5);
  resultado.semaforo       = getSemaforoCacao(resultado.precio_usd_ton);

  return resultado;
}

function getSemaforoCacao(usdTon) {
  if (usdTon >= 8_000) return 'alto';
  if (usdTon >= 3_500) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCacao };
