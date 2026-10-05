/**
 * === AMÉLIORATION AJOUTÉE (revue design) === Taille de fichier lisible :
 * « 512 o », « 37 Ko », « 2,4 Mo ». Un petit fichier n'affiche plus « 0 Ko ».
 */
export function formatFileSize(bytes: number | undefined | null): string {
  const n = typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (n < 1024) return `${Math.round(n)} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
