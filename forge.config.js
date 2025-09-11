// forge.config.js
/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
    packagerConfig: {
      asar: true,
      icon: 'assets/icon', // usa assets/icon.icns en mac y assets/icon.ico en win
      // Para dev: no firmamos. Para prod ya añadiremos notarizado/entitlements.
    },
    makers: [
      {
        name: '@electron-forge/maker-dmg',
        platforms: ['darwin'],
        config: {
          name: 'ForgeSkills',
          format: 'ULFO',      // dmg moderno; puedes usar 'ULFO' o 'UDZO'
          icon: 'assets/icon.icns',
          overwrite: true,
        },
      },
      {
        name: '@electron-forge/maker-squirrel',
        platforms: ['win32'],
        config: {
          name: 'ForgeSkills',
          setupIcon: 'assets/icon.ico',
          iconUrl: 'https://raw.githubusercontent.com/…/icon.ico', // opcional (win)
          authors: 'ForgeSkills',
          exe: 'ForgeSkills.exe',
          // oneClick: false, // si quieres asistente con pasos
        },
      },
      // Zips “por si acaso”
      {
        name: '@electron-forge/maker-zip',
        platforms: ['darwin', 'win32', 'linux'],
      },
    ],
  };
  