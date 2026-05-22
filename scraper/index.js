const fs   = require('fs');
const path = require('path');
const { scrapeCafe }  = require('./cafe');
const { scrapeCacao } = require('./cacao');

async function main() {
  console.log('Iniciando scraping...');

  const [cafe, cacao] = await Promise.all([
    scrapeCafe(),
    scrapeCacao(),
  ]);

  console.log('Café  →', cafe.en_vivo  ? 'EN VIVO'     : 'REFERENCIA', '$' + cafe.precio_kg  + '/kg');
  console.log('Cacao →', cacao.en_vivo ? 'EN VIVO'     : 'REFERENCIA', '$' + cacao.precio_cop_kg + '/kg');

  const salida = {
    generado: new Date().toISOString(),
    cafe,
    cacao,
  };

  const rutaSalida = path.join(__dirname, 'data', 'precios.json');
  fs.writeFileSync(rutaSalida, JSON.stringify(salida, null, 2), 'utf8');
  console.log('precios.json actualizado en', rutaSalida);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
