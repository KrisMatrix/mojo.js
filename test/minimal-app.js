'use strict';

const app = require('./support/minimal-app/myapp');
const t = require('tap');

t.test('Minimal app', async t => {
  const client = await app.newTestClient({tap: t});

  await t.test('Home directory', async t => {
    t.ok(app.home);
    t.ok(await app.home.exists());
    t.ok(await app.home.child('myapp.js').exists());
  });

  await t.test('Hello World', async t => {
    (await client.getOk('/')).statusIs(200).headerIs('Content-Length', '11').bodyIs('Hello Mojo!');
  });

  await client.stop();
});
