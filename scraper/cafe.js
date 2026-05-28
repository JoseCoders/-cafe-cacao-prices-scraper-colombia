const axios = require('axios');
const pdf = require('pdf-parse');

const REFERENCIA = {
  bolsa_ny: 225,
  tasa_cambio: 4200,
};

const PDF_FNC_URL = 'https://federaciondecafeteros.org/wp-content/uploads/2026/03/precio_cafe.pdf';

async function scrapeCafe() {
  const resultado = {
    fuente: 'FNC - Federación Nacional de Cafeteros',
    en_vivo: false,
    bolsa_ny: REFERENCIA.bolsa_ny,
    tasa_cambio: REFERENCIA.tasa_cambio,
    timestamp: new Date().toISOString(),
  };

  try {
    // Descargar PDF oficial de la FNC
    const { data: pdfBuffer } = await axios.get(PDF_FNC_URL, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const { text } = await pdf(pdfBuffer);

    // 👇 AGREGAR ESTA LÍNEA TEMPORAL
     console.log('[FNC] TEXTO PDF CIUDADES:', text.substring(1500, 3000));

    // Extraer precio por carga FR94
    // El PDF dice: "Precio total por carga de 125 Kg de pergamino seco FR 94  2,218,000 COP"
    const matchCarga = text.match(
      /Precio total por carga de 125 Kg.*?FR\s*94\s*([\d,]+)\s*COP/i
    );

    // Extraer bolsa Nueva York
    // El PDF dice: "Cierre contrato C Nueva York 273.40 USCent/Lb"
    const matchBolsa = text.match(
      /Cierre contrato C Nueva York\s*([\d.]+)\s*USCent/i
    );

    if (matchCarga && matchBolsa) {
      const precioCarga = parseInt(matchCarga[1].replace(/,/g, ''), 10);
      const bolsaNY = parseFloat(matchBolsa[1]);

      resultado.precio_carga  = precioCarga;
      resultado.precio_kg     = Math.round(precioCarga / 125);
      resultado.precio_arroba = Math.round(precioCarga / 10);
      resultado.bolsa_ny      = bolsaNY;
      resultado.en_vivo       = true;

      console.log('[FNC] Precio carga:', precioCarga, '| Bolsa NY:', bolsaNY);

 // ✅ NUEVO — Extraer precios por ciudad
      const ciudades = [];
      const lineaRegex = /(ARMENIA|BOGOT.|BUCARAMANGA|BUGA|CHINCHI|C.CUTA|IBAGU.|MANIZALES|MEDELL.N|NEIVA|PAMPLONA|PASTO|PEREIRA|POPAY.N|SANTA MARTA|VALLEDUPAR)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/g;
      let match;
      while ((match = lineaRegex.exec(text)) !== null) {
        ciudades.push({
          ciudad: match[1],
          carga:  parseInt(match[2].replace(/,/g, '')),
          kg:     parseInt(match[3].replace(/,/g, '')),
          arroba: parseInt(match[4].replace(/,/g, '')),
        });
      }
      if (ciudades.length > 0) {
        resultado.ciudades = ciudades;
        console.log('[FNC] Ciudades encontradas:', ciudades.length);
      }
      // ✅ FIN NUEVO



      
    } else {
      console.warn('[FNC] No se encontraron datos en el PDF, usando referencia.');
      _usarReferencia(resultado);
    }

  } catch (err) {
    console.error('[FNC] Error:', err.message);
    resultado.error = err.message;
    _usarReferencia(resultado);
  }

  // TRM - siempre desde Yahoo como respaldo
  try {
    const { data: dataTRM } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/COP=X',
      { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const trm = dataTRM.chart.result[0].meta.regularMarketPrice;
    if (trm) resultado.tasa_cambio = trm;
  } catch (e) {
    console.warn('[TRM] Error obteniendo TRM:', e.message);
  }

  resultado.semaforo = getSemaforoCafe(resultado.precio_carga);
  return resultado;
}

function _usarReferencia(resultado) {
  resultado.precio_carga  = 1_580_000;
  resultado.precio_kg     = 12_640;
  resultado.precio_arroba = 158_000;
  resultado.bolsa_ny      = REFERENCIA.bolsa_ny;
  resultado.en_vivo       = false;
}

function getSemaforoCafe(precioCarga) {
  if (precioCarga >= 1_700_000) return 'alto';
  if (precioCarga >= 1_200_000) return 'normal';
  return 'bajo';
}

module.exports = { scrapeCafe };
