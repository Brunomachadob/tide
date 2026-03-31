#!/usr/bin/env node
import { render } from 'ink'
import React from 'react'
import App from './src/App.js'

process.stdout.write('\x1b[2J\x1b[H')
const { waitUntilExit } = render(React.createElement(App))
await waitUntilExit()
