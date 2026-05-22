const axios = require('axios');

const REFERENCIA = {
  bolsa_ny: 225,
  tasa_cambio: 4200,
};

async function scrapeCafe() {
  const resultado = {
    fuente: 'ICE Futures / Yahoo Finance',
    en_vivo: false,
    bolsa_ny: REFERENCIA.bolsa_ny,
    tasa_cambio: REFERENCIA.tasa_cambio,
    timestamp: new Date().toISOString(),
  };

  try {
    // Precio café Bolsa NY - cierre del día anterior
    const { data: dataCafe } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/KCN26.NYB?range=2d&interval=1d',
      { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const bolsaNY = dataCafe.chart.result[0].indicators.quote[0].close[0];

    // TRM (COP/USD)
    const { data: dataTRM } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/COP=X',
      { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const trm = dataTRM.chart.result[0].meta.regularMarketPrice;

    if (bolsaNY && trm) {
      resultado.bolsa_ny = bolsaNY;
      resultado.tasa_cambio = trm;
      resultado.en_vivo = true;
    }
  } catch (err) {
    resultado.error = err.message;
  }

  resultado.precio_carga = Math.round(resultado.bolsa_ny * resultado.tasa_cambio * 2.2022);
  resultado.precio_kg = Math.round(resultado.precio_carga / 125);
  resultado.precio_arroba = Math.round(resultado.precio_kg * 12.5);
  resultado.semaforo = getSemaforoCafe(resultado.precio_carga);

  return resultado;
}

function getSemaforoCafe(precioCarga) {
  if (precioCarga >= 1_700_000) return 'alto';
  if (precioCarga >= 1_200_000) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCafe };
