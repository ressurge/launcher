const { app, BrowserWindow } = require('electron');
const path = require('path');
const { checkForUpdates } = require('./updateChecker');

function createWindow(url) {
  const win = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    transparent: true, // Torna a janela transparente
    resizable: false, // Opcional: desabilita redimensionamento para manter o border-radius
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, '../public/index.html'));

  checkForUpdates(win);
}

app.whenReady().then(() => {
  createWindow();

  // Configuração do protocolo customizado
  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient('ressurge');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Captura URLs abertas com "ressurge://"
app.on('open-url', (event, url) => {
  event.preventDefault();
  createWindow(url); // Abre a janela com base no URL recebido
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
