// Dev-only helper: drives the app with system Chrome and captures screenshots
// of every page for visual review. Run: node screenshot.mjs
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/ui-login.png' })

// Sign in as lead
await page.fill('input[type="email"]', 'suresh.iyer@deloitte.com')
await page.fill('input[type="password"]', 'Citi@123')
await page.click('button[type="submit"]')
await page.waitForSelector('.kpi', { timeout: 15000 })
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/ui-dashboard.png', fullPage: true })

await page.click('a[href="/pts"]')
await page.waitForSelector('.ts-own')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/ui-pts-mine.png', fullPage: true })

// Approvals tab (manager only)
await page.click('.tab:nth-child(2)')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/ui-pts-approvals.png', fullPage: true })

await page.click('a[href="/onboarding"]')
await page.waitForSelector('.lanes')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/ui-onboarding.png', fullPage: true })

await page.click('a[href="/profiles"]')
await page.waitForSelector('table')
await page.click('tbody tr.clickable')
await page.waitForSelector('.recharts-surface', { timeout: 10000 })
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/ui-profile.png', fullPage: true })

await page.click('a[href="/training"]')
await page.waitForSelector('.training-card')
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/ui-training.png', fullPage: true })

await page.click('.training-card')
await page.waitForSelector('table')
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/ui-training-detail.png', fullPage: true })

await browser.close()
console.log('screenshots written to /tmp/ui-*.png')
