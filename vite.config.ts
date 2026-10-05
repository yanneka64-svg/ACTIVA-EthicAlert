import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// === AMÉLIORATION AJOUTÉE (nouvelle version disponible) === identifiant de
// build injecté dans l'application et publié dans /version.json, comparés
// par src/app/UpdateAvailableBanner.tsx pour proposer de recharger.
const BUILD_ID = (process.env.GITHUB_SHA || '').slice(0, 12) || `b${Date.now().toString(36)}`;
function versionJsonPlugin(): Plugin {
  return {
    name: 'activa-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), versionJsonPlugin()],
    define: { __APP_BUILD_ID__: JSON.stringify(BUILD_ID) },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
