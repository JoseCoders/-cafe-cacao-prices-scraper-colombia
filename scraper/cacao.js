const axios = require('axios');

const REFERENCIA = {
  precio_usd_ton: 8800,
  tasa_cambio: 4200,
};

async function scrapeCacao() {
  const resultado = {
    fuente: 'ICE Futures / Yahoo Finance',
    en_vivo: false,
    precio_usd_ton: REFERENCIA.precio_usd_ton,
    tasa_cambio: REFERENCIA.tasa_cambio,
    timestamp: new Date().toISOString(),
  };

  try {
    // Precio cacao - cierre del día anterior
    const { data: dataCacao } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/CC=F?range=2d&interval=1d',
      { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
const closes = dataCacao.chart.result[0].indicators.quote[0].close;
const validos = closes.filter(v => v !== null);
const usdTon = validos[validos.length - 2] ?? validos[validos.length - 1];

    // TRM (COP/USD)
const { data: dataTRM } = await axios.get(
  'https://www.datos.gov.co/resource/mcec-87by.json?$limit=2&$order=vigenciadesde DESC',
  { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
);
const trm = parseFloat(dataTRM[1].valor);

    if (usdTon && trm) {
      resultado.precio_usd_ton = usdTon;
      resultado.tasa_cambio = trm;
      resultado.en_vivo = true;
    }
  } catch (err) {
    resultado.error = err.message;
  }

  resultado.precio_cop_ton = Math.round(resultado.precio_usd_ton * resultado.tasa_cambio);
  resultado.precio_cop_kg = Math.round(resultado.precio_cop_ton / 1000);
  resultado.precio_arroba = Math.round(resultado.precio_cop_kg * 12.5);
  resultado.semaforo = getSemaforoCacao(resultado.precio_usd_ton);

  return resultado;
}

function getSemaforoCacao(usdTon) {
  if (usdTon >= 8_000) return 'alto';
  if (usdTon >= 3_500) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCacao };
