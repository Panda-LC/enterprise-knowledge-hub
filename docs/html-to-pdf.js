const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    process.exit(1);
  }
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    process.exit(2);
  }
  const outPath = output ? path.resolve(output) : path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.pdf`);
  const fileUrl = pathToFileURL(inputPath).href;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('screen');
  await page.pdf({ path: outPath, format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
  await browser.close();
  process.stdout.write(outPath + "\n");
}

main();
