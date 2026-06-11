import { createContext, useContext, useState } from 'react'

// Lets detail pages register a human-friendly breadcrumb label for their path
// (e.g. /training/1 → the certification title instead of "#1").
const CrumbContext = createContext({ labels: {}, setLabel: () => {} })

export function CrumbProvider({ children }) {
  const [labels, setLabels] = useState({})
  const setLabel = (path, label) =>
    setLabels((m) => (m[path] === label ? m : { ...m, [path]: label }))
  return <CrumbContext.Provider value={{ labels, setLabel }}>{children}</CrumbContext.Provider>
}

export const useCrumbs = () => useContext(CrumbContext)
