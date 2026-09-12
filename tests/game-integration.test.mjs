import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = readFileSync('src/main/resources/templates/game/index.html', 'utf8');
const main = readFileSync('src/main/resources/static/js/game/main.mjs', 'utf8');

test('game template exposes contextual shelf restocking controls', () => {
  // 补货气泡：每行一张卡（下拉换种类 + data-restock-product 补货按钮），不再有主商品固定补货区
  for (const id of ['shelf-panel', 'shelf-product', 'shelf-extra-products']) {
    assert.match(template, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(template, /id="restock-one"/);
  assert.doesNotMatch(template, /id="serve-customer"/);
});

test('main game uses the customer simulation and shelf hit testing', () => {
  assert.match(main, /createCustomerSimulation/);
  assert.match(main, /shelfAtPoint/);
  assert.match(main, /restockShelf/);
  assert.doesNotMatch(main, /tryAutomaticService/);
});
