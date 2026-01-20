#!/usr/bin/env node

import {execute} from '@oclif/core'

// Avoid top-level await which can trigger warnings in some environments
void execute({dir: import.meta.url}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
