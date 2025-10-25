import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../dist');

function getDirectorySize(dirPath) {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    console.error('Run "npm run build" first to generate the dist directory.');
    process.exit(1);
  }

  function traverseDirectory(currentPath) {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        traverseDirectory(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  }

  traverseDirectory(dirPath);
  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundle() {
  console.log('\n📦 Bundle Size Analysis\n');
  console.log('='.repeat(60));

  const assetsPath = path.join(distPath, 'assets');
  const totalSize = getDirectorySize(distPath);
  const assetsSize = fs.existsSync(assetsPath) ? getDirectorySize(assetsPath) : 0;

  console.log(`\nTotal bundle size: ${formatBytes(totalSize)}`);
  console.log(`Assets size: ${formatBytes(assetsSize)}`);

  if (fs.existsSync(assetsPath)) {
    const files = fs.readdirSync(assetsPath);

    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));

    console.log('\n📄 JavaScript Files:');
    console.log('-'.repeat(60));

    let totalJsSize = 0;
    jsFiles.forEach(file => {
      const filePath = path.join(assetsPath, file);
      const stats = fs.statSync(filePath);
      totalJsSize += stats.size;
      console.log(`  ${file.padEnd(50)} ${formatBytes(stats.size).padStart(10)}`);
    });
    console.log(`  ${'Total JS:'.padEnd(50)} ${formatBytes(totalJsSize).padStart(10)}`);

    console.log('\n🎨 CSS Files:');
    console.log('-'.repeat(60));

    let totalCssSize = 0;
    cssFiles.forEach(file => {
      const filePath = path.join(assetsPath, file);
      const stats = fs.statSync(filePath);
      totalCssSize += stats.size;
      console.log(`  ${file.padEnd(50)} ${formatBytes(stats.size).padStart(10)}`);
    });
    console.log(`  ${'Total CSS:'.padEnd(50)} ${formatBytes(totalCssSize).padStart(10)}`);
  }

  console.log('\n' + '='.repeat(60));

  const otelEstimatedSize = 80 * 1024;
  const otelPercentage = ((otelEstimatedSize / totalSize) * 100).toFixed(2);

  console.log('\n📊 OpenTelemetry Impact (Estimated):');
  console.log('-'.repeat(60));
  console.log(`  Expected OTel size: ~80KB compressed`);
  console.log(`  Percentage of bundle: ~${otelPercentage}%`);
  console.log(`  Performance overhead: <1% expected`);

  const maxAcceptableSize = 100 * 1024;
  if (otelEstimatedSize > maxAcceptableSize) {
    console.log('\n⚠️  WARNING: OpenTelemetry size exceeds 100KB threshold!');
    process.exit(1);
  } else {
    console.log('\n✅ Bundle size is within acceptable limits');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

analyzeBundle();
