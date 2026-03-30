#!/usr/bin/env node
import { render } from 'ink'
import React from 'react'
import App from './src/App.js'

const { waitUntilExit } = render(React.createElement(App))
await waitUntilExit()
