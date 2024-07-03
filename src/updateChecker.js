const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { app } = require('electron');

const appDataPath = path.join(os.homedir(), 'AppData', 'Local', 'RessurgeLauncher');
const jarFileNamePrefix = 'Ressurge_v';
const jarFileExtension = '.ja.jar';

async function checkForUpdates(win) {
  try {
    const response = await axios.get('https://api.github.com/repos/ressurge/Loader/releases/latest');
    const latestVersion = response.data.tag_name;

    win.webContents.send('update-progress', 10, 'Dados do lançamento recebidos');

    if (!response.data.assets || response.data.assets.length === 0) {
      console.error('Nenhum ativo encontrado no lançamento.');
      return;
    }

    const asset = response.data.assets.find(asset => asset.name.includes(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`));
    
    if (!asset) {
      console.error('Ativo desejado não encontrado nos lançamentos.');
      return;
    }

    const downloadUrl = asset.browser_download_url;

    const localJar = getLocalJarVersion();
    if (!localJar || localJar !== latestVersion) {
      win.webContents.send('update-progress', 30, 'Baixando nova versão...');
      await downloadFile(downloadUrl, `${jarFileNamePrefix}${latestVersion}${jarFileExtension}`, win);
    } else {
      win.webContents.send('update-progress', 70, 'Você já tem a versão mais recente.');
      await delay(1000);
      win.webContents.send('update-progress', 100, 'Abrindo o cliente...');
      await delay(2000);
    }
    executeJar(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`, win);
  } catch (error) {
    console.error('Erro ao verificar atualizações:', error);
    const localJar = getLocalJarPath();
    if (localJar) {
      win.webContents.send('update-progress', 100, 'Abrindo o cliente...');
      await delay(2000);
      executeJar(localJar, win);
    }
  }
}

function getLocalJarVersion() {
  if (fs.existsSync(appDataPath)) {
    const files = fs.readdirSync(appDataPath);
    const jarFile = files.find(file => file.startsWith(jarFileNamePrefix) && file.endsWith(jarFileExtension));
    if (jarFile) {
      const versionMatch = jarFile.match(/Ressurge_v([\d.]+)\.ja\.jar/);
      return versionMatch ? versionMatch[1] : null;
    }
  }
  return null;
}

function getLocalJarPath() {
  if (fs.existsSync(appDataPath)) {
    const files = fs.readdirSync(appDataPath);
    return files.find(file => file.startsWith(jarFileNamePrefix) && file.endsWith(jarFileExtension));
  }
  return null;
}

async function downloadFile(url, filename, win) {
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }

  const filePath = path.join(appDataPath, filename);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const totalLength = parseInt(response.headers['content-length'], 10);

  response.data.pipe(writer);

  let downloadedLength = 0;

  response.data.on('data', (chunk) => {
    downloadedLength += chunk.length;
    const progress = (downloadedLength / totalLength) * 100;
    win.webContents.send('update-progress', Math.round(progress), 'Baixando nova versão...');
  });

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      win.webContents.send('update-progress', 100, 'Download concluído.');
      resolve();
    });
    writer.on('error', reject);
  });
}

function executeJar(jarFile, win) {
  const filePath = path.join(appDataPath, jarFile);
  exec(`java -jar "${filePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao executar o arquivo: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Erro na execução: ${stderr}`);
      return;
    }
    console.log(`Saída: ${stdout}`);
  });
  app.quit();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { checkForUpdates };
