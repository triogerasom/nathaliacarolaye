const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(require('node:os').tmpdir(), 'nathalia-visual-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/config', (route) => route.fulfill({ json: {} }));
  await page.goto('http://127.0.0.1:4178');
  await page.screenshot({ path: path.join(output, 'login.png') });
  // Isolated browser-only fixture: never sent to a real account or remote storage.
  await page.evaluate(() => {
    state.auth.loggedIn = true;
    state.auth.mustChangePassword = false;
    state.fiemg.autoSync = false;
    renderAuth();
    render();
  });
  const entryXml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc><NFe><infNFe Id="NFe31260911111111000111550010000000011000000010"><ide><natOp>COMPRA</natOp><serie>1</serie><nNF>1</nNF><dhEmi>2026-09-16T10:00:00-03:00</dhEmi></ide><emit><CNPJ>11111111000111</CNPJ><xNome>FORNECEDOR TESTE</xNome></emit><dest><CNPJ>68205288000174</CNPJ><xNome>NATHALIA</xNome></dest><det nItem="1"><prod><cProd>CX8</cProd><cEAN>7890000000001</cEAN><xProd>PRODUTO TESTE CX C/ 8 UN</xProd><NCM>22021000</NCM><CFOP>5102</CFOP><uCom>CX</uCom><qCom>2</qCom><vUnCom>40</vUnCom><vProd>80</vProd><cEANTrib>7890000000001</cEANTrib><uTrib>CX</uTrib><qTrib>2</qTrib><vUnTrib>40</vUnTrib></prod><imposto /></det><det nItem="2"><prod><cProd>XML8</cProd><cEAN>7890000000002</cEAN><xProd>PRODUTO CONVERSAO XML</xProd><NCM>22021000</NCM><CFOP>5102</CFOP><uCom>CX</uCom><qCom>3</qCom><vUnCom>40</vUnCom><vProd>120</vProd><cEANTrib>7890000000002</cEANTrib><uTrib>UN</uTrib><qTrib>24</qTrib><vUnTrib>5</vUnTrib></prod><imposto /></det><total><ICMSTot><vNF>200</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>31260911111111000111550010000000011000000010</chNFe></infProt></protNFe></nfeProc>`;
  await page.evaluate((xml) => {
    const document = importNfe(xml, 'teste-caixa-8.xml');
    renderImportResult(document);
    switchView('importar');
  }, entryXml);
  assert.equal(await page.evaluate(() => state.products['7890000000001'].stock), 16, 'description conversion must split 2 boxes into 16 units');
  assert.equal(await page.evaluate(() => state.products['7890000000001'].lastPurchasePrice), 5, 'description conversion must calculate unit cost');
  assert.equal(await page.evaluate(() => state.products['7890000000002'].stock), 24, 'qTrib conversion must take priority');
  assert.equal(await page.evaluate(() => state.products['7890000000002'].lastPurchasePrice), 5, 'XML taxable unit price must be preserved');
  await page.locator('.conversion-input').first().fill('10');
  await page.locator('.conversion-input').first().press('Tab');
  assert.equal(await page.evaluate(() => state.products['7890000000001'].stock), 20, 'manual conversion must adjust stock');
  assert.equal(await page.evaluate(() => state.products['7890000000001'].lastPurchasePrice), 4, 'manual conversion must recalculate unit cost');
  await page.screenshot({ path: path.join(output, 'dashboard-desktop.png'), fullPage: true });
  const views = ['dashboard', 'importar', 'estoque', 'produtos', 'propostas', 'integracoes', 'exportar', 'documentos', 'plataforma', 'auditoria'];
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of views) {
      await page.evaluate((id) => switchView(id), view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${view} overflows at ${width}px`);
      assert.equal(await page.locator('.view.active').count(), 1);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => switchView('dashboard'));
  await page.screenshot({ path: path.join(output, 'dashboard-mobile.png'), fullPage: true });
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('.nav-item[data-view="propostas"]').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
  await page.fill('#proposal-customer', 'Cliente de teste local');
  await page.fill('#proposal-desc', 'Item de teste');
  await page.fill('#proposal-price', '12.50');
  await page.locator('#proposal-form button').click();
  assert.match(await page.locator('#proposal-total').innerText(), /12,50/);
  await page.locator('.remove-proposal-item svg').click();
  assert.match(await page.locator('#proposal-total').innerText(), /0,00/);
  await page.route('**/api/fiemg-import', (route) => route.fulfill({ json: { ok: true, processes: [{ externalProcessId: 1, processNumber: 'SDE 2026000001', object: 'Teste <img src=x onerror=alert(1)>', entity: 'FIEMG', portalStatus: 'Aberto', items: [{ externalItemId: 5, description: 'Produto para conferência', quantity: 10, unit: 'UN', referenceUnitPrice: 5 }] }] } }));
  await page.evaluate(() => switchView('integracoes'));
  await page.fill('#fiemg-import-code', 'SDE 2026000001');
  await page.locator('#fiemg-import-button').click();
  await page.waitForFunction(() => !fiemgImportBusy);
  assert.equal(await page.locator('#fiemg-rows img').count(), 0);
  assert.equal(await page.locator('#fiemg-rows .process-link').count(), 1);
  assert.match(await page.locator('#fiemg-rows .process-link').getAttribute('href'), /fiemg-detail\.html/);
  await page.locator('.fiemg-items summary').click();
  assert.match(await page.locator('.fiemg-items').innerText(), /Produto para conferência/);
  await page.locator('#fiemg-sync-button').click();
  await page.waitForFunction(() => !fiemgImportBusy);
  assert.equal(await page.locator('#fiemg-rows > tr').count(), 1, 'Reimport must not duplicate');
  await page.fill('#integracoes .table-toolbar input', 'inexistente');
  assert.equal(await page.locator('#fiemg-rows > tr:visible').count(), 0);
  await page.fill('#integracoes .table-toolbar input', '');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, 'fiemg-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(JSON.stringify({ result: 'passed', views: views.length, widths: 5, checks: ['navigation', 'fiscal package conversion', 'unit cost', 'proposal add/remove', 'FIEMG import/details', 'deduplication', 'search', 'HTML escaping'], screenshots: output }));
})().catch((error) => { console.error(error); process.exit(1); });
