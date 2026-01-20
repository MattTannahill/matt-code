#!/usr/bin/env node

import {execute} from '@oclif/core'

// Avoid top-level await which can trigger warnings in some environments
const args = process.argv.slice(2).length === 0 ? ['ui'] : process.argv.slice(2);
void execute({dir: import.meta.url, args}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
