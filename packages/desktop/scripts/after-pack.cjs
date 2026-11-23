const fs = require('node:fs');
const path = require('node:path');
const plist = require('plist');

const UTIS_BY_ICON_FILE = {
  'file-word.icns': [
    'org.openxmlformats.wordprocessingml.document',
    'org.openxmlformats.wordprocessingml.template',
    'com.microsoft.word.doc',
    'org.oasis-open.opendocument.text',
    'public.rtf',
  ],
  'file-excel.icns': [
    'org.openxmlformats.spreadsheetml.sheet',
    'org.openxmlformats.spreadsheetml.template',
    'com.microsoft.excel.xls',
    'org.oasis-open.opendocument.spreadsheet',
  ],
  'file-csv.icns': ['public.comma-separated-values-text'],
  'file-powerpoint.icns': [
    'org.openxmlformats.presentationml.presentation',
    'org.openxmlformats.presentationml.template',
    'com.microsoft.powerpoint.ppt',
    'org.oasis-open.opendocument.presentation',
  ],
  'file-pdf.icns': ['com.adobe.pdf'],
  'file-hwp.icns': [
    'com.hancom.hwp',
    'com.hancom.hwpx',
    'org.hancom.hwp',
    'org.hancom.hwpx',
  ],
};

const HWP_IMPORTED_UTIS = [
  {
    UTTypeIdentifier: 'com.hancom.hwp',
    UTTypeDescription: 'Hangul Word Processor Document',
    UTTypeConformsTo: ['public.data'],
    UTTypeIconFile: 'file-hwp.icns',
    UTTypeTagSpecification: {
      'public.filename-extension': ['hwp'],
      'public.mime-type': ['application/x-hwp', 'application/haansofthwp'],
    },
  },
  {
    UTTypeIdentifier: 'com.hancom.hwpx',
    UTTypeDescription: 'Hangul Open XML Document',
    UTTypeConformsTo: ['public.data', 'public.zip-archive'],
    UTTypeIconFile: 'file-hwp.icns',
    UTTypeTagSpecification: {
      'public.filename-extension': ['hwpx'],
      'public.mime-type': ['application/hwp+zip'],
    },
  },
];

/**
 * Enrich macOS `Info.plist` `CFBundleDocumentTypes` with explicit `LSItemContentTypes` (UTIs)
 * and `UTImportedTypeDeclarations` so Finder & IconServices render our custom per-format document
 * icons (`file-csv.icns`, `file-word.icns`, etc.) instead of generic system UTI icons.
 */
function enrichMacInfoPlist(infoPlist) {
  const next = { ...infoPlist };

  if (Array.isArray(next.CFBundleDocumentTypes)) {
    next.CFBundleDocumentTypes = next.CFBundleDocumentTypes.map((docType) => {
      const iconFile = String(docType?.CFBundleTypeIconFile || '');
      const utis = UTIS_BY_ICON_FILE[iconFile];
      if (!utis) return docType;
      const existingUtis = Array.isArray(docType.LSItemContentTypes)
        ? docType.LSItemContentTypes
        : [];
      return {
        ...docType,
        CFBundleTypeIconSystemGenerated: 0,
        LSItemContentTypes: [...new Set([...existingUtis, ...utis])],
      };
    });
  }

  const existingImported = Array.isArray(next.UTImportedTypeDeclarations)
    ? next.UTImportedTypeDeclarations
    : [];
  const existingIds = new Set(existingImported.map((item) => item?.UTTypeIdentifier));
  next.UTImportedTypeDeclarations = [
    ...existingImported,
    ...HWP_IMPORTED_UTIS.filter((item) => !existingIds.has(item.UTTypeIdentifier)),
  ];

  return next;
}

async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const plistPath = path.join(context.appOutDir, appName, 'Contents', 'Info.plist');
  if (!fs.existsSync(plistPath)) return;

  const parsed = plist.parse(fs.readFileSync(plistPath, 'utf8'));
  const enriched = enrichMacInfoPlist(parsed);
  fs.writeFileSync(plistPath, plist.build(enriched), 'utf8');
  console.log(`[after-pack] Enriched macOS Info.plist with LSItemContentTypes & UTIs: ${plistPath}`);
}

afterPack.enrichMacInfoPlist = enrichMacInfoPlist;
module.exports = afterPack;
