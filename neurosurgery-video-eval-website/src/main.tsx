import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { legacyRouteFromHash, PAGE_SEO, routeFromPath, routePath } from './data/routes.ts'

function redirectLegacyRoute(): boolean {
  const legacy = legacyRouteFromHash(window.location.hash)
  if (legacy) {
    window.location.replace(`${routePath(legacy)}${window.location.search}`)
    return true
  }
  return false
}

function start() {
  if (redirectLegacyRoute()) return
  const route = routeFromPath(window.location.pathname)
  if (route && window.location.pathname !== routePath(route)) {
    window.location.replace(`${routePath(route)}${window.location.search}${window.location.hash}`)
    return
  }
  const root = document.getElementById('root')!
  const app = <StrictMode><App route={route} /></StrictMode>
  if (root.dataset.prerendered === 'true') hydrateRoot(root, app)
  else {
    document.title = route ? PAGE_SEO[route].title : 'Page not found | Surgical Intelligence Leaderboard'
    createRoot(root).render(app)
  }
}

start()
window.addEventListener('hashchange', redirectLegacyRoute)
