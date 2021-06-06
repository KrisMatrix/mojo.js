#!/usr/bin/env node
import mojo from '../lib/mojo.js';

const app = mojo({detectImport: false});

app.any('/', ctx => ctx.render({text: 'Hello Mojo!'}));

app.start();
