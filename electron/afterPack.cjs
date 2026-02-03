/**
 * electron-builder afterPack hook
 * Copies the server node_modules and public to the unpacked resources
 */
const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const { appOutDir, packager } = context;
  
  // Copy node_modules
  const sourceNodeModules = path.join(packager.projectDir, '.output', 'server', 'node_modules');
  const targetNodeModules = path.join(appOutDir, 'resources', 'server', 'node_modules');
  
  console.log(`Copying node_modules from ${sourceNodeModules} to ${targetNodeModules}`);
  
  if (fs.existsSync(sourceNodeModules)) {
    copyFolderRecursiveSync(sourceNodeModules, path.dirname(targetNodeModules));
    console.log('node_modules copied successfully');
  } else {
    console.warn('Warning: .output/server/node_modules not found');
  }
  
  // Copy public folder to resources/public (Nitro expects it there)
  const sourcePublic = path.join(packager.projectDir, '.output', 'public');
  const targetPublic = path.join(appOutDir, 'resources', 'public');
  
  console.log(`Copying public from ${sourcePublic} to ${targetPublic}`);
  
  if (fs.existsSync(sourcePublic)) {
    copyFolderRecursiveSync(sourcePublic, path.dirname(targetPublic));
    console.log('public copied successfully');
  } else {
    console.warn('Warning: .output/public not found');
  }
};

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      const curTarget = path.join(targetFolder, file);
      
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else if (fs.lstatSync(curSource).isSymbolicLink()) {
        // Preserve symlinks
        const symlinkTarget = fs.readlinkSync(curSource);
        try {
          fs.symlinkSync(symlinkTarget, curTarget);
        } catch (e) {
          // If symlink fails, copy the actual file
          fs.copyFileSync(fs.realpathSync(curSource), curTarget);
        }
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}
