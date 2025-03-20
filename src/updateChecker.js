const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { app } = require('electron');

const appDataPath = path.join(os.homedir(), 'AppData', 'Local', 'Ressurge');
const jarFileNamePrefix = 'Ressurge_v';
const jarFileExtension = '.jar';

async function checkForUpdates(win) {
  try {
    const response = await axios.get('https://api.github.com/repos/ressurge/client/releases/latest');
    const latestVersion = response.data.tag_name;

    if (!response.data.assets || response.data.assets.length === 0) {
      console.error('No assets found in the release.');
      return;
    }

    const asset = response.data.assets.find(asset => asset.name.includes(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`));

    if (!asset) {
      console.error('Desired asset not found in the release.');
      return;
    }

    const downloadUrl = asset.browser_download_url;

    const localJar = getLocalJarVersion();
    if (!localJar || localJar !== latestVersion) {
      // Show download progress only if a new version needs to be downloaded
      win.webContents.send('update-progress', 10, 'Downloading new version...');
      await downloadFile(downloadUrl, `${jarFileNamePrefix}${latestVersion}${jarFileExtension}`, win);
      win.webContents.send('update-progress', 100, 'Download complete. Opening the client...');
    } else {
      // If the latest version is already available, do nothing and just execute it
      executeJar(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`, win);
      return;
    }

    executeJar(`${jarFileNamePrefix}${latestVersion}${jarFileExtension}`, win);
  } catch (error) {
    console.error('Error checking for updates:', error);
    const localJar = getLocalJarPath();
    if (localJar) {
      executeJar(localJar, win); // Execute the local jar if there are no updates
    }
  }
}


function getLocalJarVersion() {
  if (fs.existsSync(appDataPath)) {
    const files = fs.readdirSync(appDataPath);
    console.log('Files found:', files); // Log for debugging

    const jarFile = files.find(file => file.startsWith(jarFileNamePrefix) && file.endsWith(jarFileExtension));
    console.log('File found:', jarFile); // Log for debugging

    if (jarFile) {
      const versionMatch = jarFile.match(/Ressurge_v([\d\.]+)\.jar/);
      return versionMatch ? versionMatch[1] : null;
    }
  }
  return null;
}


function getLocalJarPath() {
  if (fs.existsSync(appDataPath)) {
    const files = fs.readdirSync(appDataPath);

    // Check if any file starts with the prefix and ends with the .jar extension
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
    win.webContents.send('update-progress', Math.round(progress), 'Downloading new version...');
  });

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      win.webContents.send('update-progress', 100, 'Download complete.');
      resolve();
    });
    writer.on('error', reject);
  });
}

function executeJar(jarFile, win) {
  const filePath = path.join(appDataPath, jarFile);
  exec(`java -jar "${filePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing the file: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error during execution: ${stderr}`);
      return;
    }
    console.log(`Output: ${stdout}`);
  });
  app.quit();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { checkForUpdates };
