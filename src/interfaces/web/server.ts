import { loadLocalEnv } from '../../infrastructure/config/loadDotEnv.js';
import { createWebServer } from './httpApp.js';

loadLocalEnv();

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';

process.on('unhandledRejection', (reason) => {
  console.error('[ITV] Promesa no controlada:', reason);
});

const server = createWebServer();

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚗 ITV de Código — Dashboard Web Local');
  console.log(`   URL local : http://${HOST}:${PORT}`);
  console.log('   Modo      : 100% local · Solo lectura · Cero cuentas externas');
  console.log('');
});
