const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { app } = require('electron');

const appDataPath = path.join(os.homedir(), 'AppData', 'Local', 'RessurgeLauncher');
const jarFileNamePrefix = 'Ressurge_v'; // Prefixo do nome do arquivo
const jarFileExtension = '.ja.jar'; // Extensão do nome do arquivo

async function checkForUpdates() {
  try {
    const response = await axios.get('https://api.github.com/repos/ressurge/Loader/releases/latest');
    const latestVersion = response.data.tag_name; // Supondo que a tag_name seja a versão do lançamento

    console.log('Dados do lançamento:', response.data);

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
      console.log(`Nova versão disponível: ${latestVersion}. Baixando...`);
      await downloadFile(downloadUrl, `${jarFileNamePrefix}${latestVersion}${jarFileExtension}`);
    } else {
      console.log('Você já tem a versão mais recente.');
    }
    executeJar(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`);
  } catch (error) {
    console.error('Erro ao verificar atualizações:', error);
    const localJar = getLocalJarPath();
    if (localJar) {
      executeJar(localJar);
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

async function downloadFile(url, filename) {
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

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function executeJar(jarFile) {
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

module.exports = { checkForUpdates };
