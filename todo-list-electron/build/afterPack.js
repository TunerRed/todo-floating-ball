const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  // Only for Windows/Linux usually. macOS puts locales in Resources.
  // For Windows, it's directly in the appOutDir/locales
  
  const localeDir = path.join(context.appOutDir, 'locales');
  
  if (fs.existsSync(localeDir)) {
    console.log(`Cleaning locales in ${localeDir}...`);
    const files = fs.readdirSync(localeDir);
    let deleted = 0;
    for (const file of files) {
      // Keep en-US, zh-CN.
      // Note: Electron locales are usually like 'en-US.pak', 'zh-CN.pak'
      if (!file.startsWith('zh-CN') && !file.startsWith('en-US')) {
        try {
          fs.unlinkSync(path.join(localeDir, file));
          deleted++;
        } catch (e) {
          console.error(`Failed to delete ${file}:`, e);
        }
      }
    }
    console.log(`Deleted ${deleted} unused locale files.`);
  } else {
      console.log(`Locales directory not found at ${localeDir}`);
  }
}
