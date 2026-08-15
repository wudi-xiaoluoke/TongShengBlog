import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = readFileSync('src/main/resources/templates/game/index.html', 'utf8');
const main = readFileSync('src/main/resources/static/js/game/main.mjs', 'utf8');

test('game template exposes contextual shelf restocking controls', () => {
  for (const id of ['shelf-panel', 'shelf-product', 'shelf-stock', 'warehouse-stock', 'restock-one', 'restock-five', 'restock-full']) {
    assert.match(template, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(template, /id="serve-customer"/);
});

test('main game uses the customer simulation and shelf hit testing', () => {
  assert.match(main, /createCustomerSimulation/);
  assert.match(main, /shelfAtPoint/);
  assert.match(main, /restockShelf/);
  assert.doesNotMatch(main, /tryAutomaticService/);
});
