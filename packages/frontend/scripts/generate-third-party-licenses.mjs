import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(frontendDir, '../..');
const desktopDir = path.join(rootDir, 'packages', 'desktop');
const outputFile = path.join(frontendDir, 'public', 'THIRD-PARTY-LICENSES.txt');

const FRONTEND_BUNDLED_DEV_DEPS = [
  '@fontsource-variable/noto-sans-kr',
  '@fontsource/noto-sans-kr',
  '@noto-pdf-ts/fonts-kr',
];

const DESKTOP_BUNDLED_DEV_DEPS = ['electron'];

const LICENSE_FILE_RE = /^(?:license|licence|copying|notice|ofl)(?:\..+)?$/i;
const NOTICE_FILE_RE = /^notice(?:\..+)?$/i;
const SEPARATOR = '='.repeat(80);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function resolvePackageDir(pkgName, fromDir) {
  const candidates = [];
  let cursor = path.resolve(fromDir);
  while (true) {
    candidates.push(path.join(cursor, 'node_modules', pkgName));
    if (cursor === rootDir) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const dir of [frontendDir, desktopDir, rootDir]) {
    const candidate = path.join(dir, 'node_modules', pkgName);
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  for (const candidate of candidates) {
    const pkgJsonPath = path.join(candidate, 'package.json');
    if (existsSync(pkgJsonPath)) {
      return candidate;
    }
  }
  return null;
}

function formatLicenseField(pkg) {
  if (typeof pkg.license === 'string' && pkg.license.trim()) {
    return pkg.license.trim();
  }
  if (pkg.license && typeof pkg.license === 'object' && typeof pkg.license.type === 'string') {
    return pkg.license.type.trim();
  }
  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .filter(Boolean);
    if (types.length > 0) return types.join(' OR ');
  }
  return 'UNKNOWN';
}

function formatAuthorField(author) {
  if (!author) return '';
  if (typeof author === 'string') return author.trim();
  if (typeof author === 'object') {
    const name = typeof author.name === 'string' ? author.name.trim() : '';
    const email = typeof author.email === 'string' ? ` <${author.email.trim()}>` : '';
    const url = typeof author.url === 'string' ? ` (${author.url.trim()})` : '';
    return `${name}${email}${url}`.trim();
  }
  return '';
}

function formatSourceField(pkg) {
  const repo = pkg.repository;
  if (typeof repo === 'string' && repo.trim()) return repo.trim();
  if (repo && typeof repo === 'object' && typeof repo.url === 'string' && repo.url.trim()) {
    return repo.url.trim();
  }
  if (typeof pkg.homepage === 'string' && pkg.homepage.trim()) {
    return pkg.homepage.trim();
  }
  return '';
}

function collectLicenseFiles(pkgDir) {
  let entries;
  try {
    entries = readdirSync(pkgDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const matched = [];
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (!LICENSE_FILE_RE.test(entry.name)) continue;
    const fullPath = path.join(pkgDir, entry.name);
    try {
      if (!statSync(fullPath).isFile()) continue;
      const content = readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n').trim();
      if (content) {
        matched.push({ fileName: entry.name, content });
      }
    } catch {
      // Skip unreadable file
    }
  }

  matched.sort((a, b) => {
    const aIsNotice = NOTICE_FILE_RE.test(a.fileName) ? 1 : 0;
    const bIsNotice = NOTICE_FILE_RE.test(b.fileName) ? 1 : 0;
    if (aIsNotice !== bIsNotice) return aIsNotice - bIsNotice;
    return a.fileName.localeCompare(b.fileName, 'en');
  });

  return matched;
}

function collectAllPackages() {
  const frontendPkg = readJson(path.join(frontendDir, 'package.json'));
  const desktopPkg = readJson(path.join(desktopDir, 'package.json'));

  const seeds = [];
  for (const name of Object.keys(frontendPkg.dependencies ?? {})) {
    seeds.push({ name, fromDir: frontendDir });
  }
  for (const name of FRONTEND_BUNDLED_DEV_DEPS) {
    if (frontendPkg.devDependencies?.[name]) {
      seeds.push({ name, fromDir: frontendDir });
    }
  }
  for (const name of Object.keys(desktopPkg.dependencies ?? {})) {
    seeds.push({ name, fromDir: desktopDir });
  }
  for (const name of DESKTOP_BUNDLED_DEV_DEPS) {
    if (desktopPkg.devDependencies?.[name]) {
      seeds.push({ name, fromDir: desktopDir });
    }
  }

  const packages = new Map();
  const queue = [...seeds];

  while (queue.length > 0) {
    const { name, fromDir } = queue.shift();
    const pkgDir = resolvePackageDir(name, fromDir);
    if (!pkgDir) continue;

    let pkg;
    try {
      pkg = readJson(path.join(pkgDir, 'package.json'));
    } catch {
      continue;
    }

    const pkgName = pkg.name || name;
    const pkgVersion = pkg.version || '0.0.0';
    const key = `${pkgName}@${pkgVersion}`;
    if (packages.has(key)) continue;

    packages.set(key, {
      name: pkgName,
      version: pkgVersion,
      license: formatLicenseField(pkg),
      author: formatAuthorField(pkg.author),
      source: formatSourceField(pkg),
      files: collectLicenseFiles(pkgDir),
    });

    const nextDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.optionalDependencies ?? {}),
    };
    for (const depName of Object.keys(nextDeps)) {
      queue.push({ name: depName, fromDir: pkgDir });
    }
  }

  return [...packages.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'en');
    if (byName !== 0) return byName;
    return a.version.localeCompare(b.version, 'en');
  });
}

function buildNoticesText(records) {
  const lines = [
    'Sejong Office (sejong-office) — Third-Party Package Licenses & Notices',
    SEPARATOR,
    'This file is auto-generated from bundled runtime dependencies of',
    '@sejong-office/frontend and @sejong-office/desktop.',
    '',
    'For the application license (GPL-3.0-only), see LICENSE.',
    'For component summaries, embedded fonts, and trademark notices, see THIRD-PARTY-NOTICES.md.',
    `Total third-party packages: ${records.length}`,
    '',
  ];

  for (const pkg of records) {
    lines.push(SEPARATOR);
    lines.push(`${pkg.name}@${pkg.version}`);
    lines.push(`License: ${pkg.license}`);
    if (pkg.author) lines.push(`Author: ${pkg.author}`);
    if (pkg.source) lines.push(`Source: ${pkg.source}`);
    lines.push('');

    if (pkg.files.length === 0) {
      lines.push(
        `(No separate LICENSE/NOTICE file included in package directory; declared license: ${pkg.license})`,
      );
      lines.push('');
      continue;
    }

    for (const file of pkg.files) {
      lines.push(`--- ${file.fileName} ---`);
      lines.push(file.content);
      lines.push('');
    }
  }

  return lines.join('\n');
}

const records = collectAllPackages();
const output = buildNoticesText(records);
mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, output, 'utf8');
console.log(
  `Generated ${path.relative(rootDir, outputFile)} (${records.length} packages, ${Buffer.byteLength(output, 'utf8')} bytes)`,
);
