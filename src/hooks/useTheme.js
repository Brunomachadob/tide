import { createContext, useContext } from 'react'

const defaultTheme = {
  accent: 'cyan',
}

export const ThemeContext = createContext(defaultTheme)

export default function useTheme() {
  return useContext(ThemeContext)
}
