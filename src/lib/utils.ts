/**
 * Converte links do Google Drive para links diretos de imagem.
 */
export function getDirectDriveUrl(url: string): string {
  if (!url) return '';
  
  // Verifica se é um link do Google Drive
  if (url.includes('drive.google.com')) {
    let fileId = '';
    
    // Padrão /file/d/[ID]/view
    if (url.includes('/file/d/')) {
      fileId = url.split('/file/d/')[1].split('/')[0];
    } 
    // Padrão ?id=[ID]
    else if (url.includes('id=')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      fileId = urlParams.get('id') || '';
    }

    if (fileId) {
      // Formato mais estável para exibição direta
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  
  return url;
}
