import pdfmake from 'pdfmake';
import * as path from 'path';

// Resolve the bundled Roboto fonts that ship with pdfmake.
// Using absolute paths so this works in both dev (ts-node) and production (dist/).
const fontsDir = path.resolve(
  require.resolve('pdfmake/package.json'),
  '..',
  'build',
  'fonts',
  'Roboto',
);

pdfmake.addFonts({
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
  },
});

// Allow local font files; deny all remote URLs.
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => false);

export { pdfmake };
