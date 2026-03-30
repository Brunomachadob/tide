#!/usr/bin/env node
import { createRequire } from 'module'
import { render } from 'ink'
import React from 'react'
import App from './src/App.js'

// Allow requiring CommonJS lib modules from ESM
const require = createRequire(import.meta.url)
global.__scheduler_require = require

const { waitUntilExit } = render(React.createElement(App))
await waitUntilExit()
