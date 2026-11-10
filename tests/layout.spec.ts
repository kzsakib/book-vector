import { expect, test, type Page } from '@playwright/test'

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 800 },
  { width: 1280, height: 720 },
  { width: 1024, height: 700 },
]

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => {
      const store = (window as unknown as { __atlas?: { getState: () => { phase: string; count: number } } })
        .__atlas
      const state = store?.getState()
      return state?.phase === 'ready' && state.count > 0
    },
    undefined,
    { timeout: 30_000 },
  )
  await page.locator('.rail-left').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(1500)
}

async function zoom(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __view?: { zoom: number } }).__view?.zoom ?? 0,
  )
}

async function wheel(page: Page, deltaY: number, times: number) {
  const canvas = page.locator('.stage-canvas canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, deltaY)
    await page.waitForTimeout(60)
  }
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size })

    test('page never scrolls and every panel stays inside the viewport', async ({ page }) => {
      await ready(page)

      const metrics = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        bodyScroll: document.body.scrollHeight,
      }))
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight)
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth)
      expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.innerHeight)

      const selectors = ['.app-header', '.rail-left', '.stage', '.dock-btn']
      for (const selector of selectors) {
        const nodes = page.locator(selector)
        const count = await nodes.count()
        expect(count, `${selector} should exist`).toBeGreaterThan(0)
        for (let i = 0; i < count; i++) {
          const box = await nodes.nth(i).boundingBox()
          if (!box) continue
          expect(box.x, `${selector} left`).toBeGreaterThanOrEqual(-1)
          expect(box.y, `${selector} top`).toBeGreaterThanOrEqual(-1)
          expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(size.width + 1)
          expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(size.height + 1)
        }
      }

      // The dock sits below the canvas, never over it.
      const canvasBox = await page.locator('.stage-canvas canvas').first().boundingBox()
      const dockBox = await page.locator('.stage-dock').first().boundingBox()
      expect(canvasBox).not.toBeNull()
      expect(dockBox).not.toBeNull()
      expect(dockBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 12)

      await page.screenshot({ path: `artifacts/pw-${size.width}x${size.height}.png` })
    })

    test('wheel zooms the globe to both clamps without scrolling the page', async ({ page }) => {
      await ready(page)
      const before = await zoom(page)
      await wheel(page, -350, 6)
      await page.waitForTimeout(350)
      const scrolled = await page.evaluate(() => window.scrollY)
      expect(scrolled).toBe(0)
      const afterIn = await zoom(page)
      expect(afterIn).toBeGreaterThan(before)

      // Keep zooming in; the distance must settle at the near clamp.
      await wheel(page, -350, 60)
      await page.waitForTimeout(1400)
      const nearA = await zoom(page)
      await wheel(page, -350, 6)
      await page.waitForTimeout(1400)
      const nearB = await zoom(page)
      expect(Math.abs(nearB - nearA)).toBeLessThan(0.03)
      const nearView = await page.evaluate(
        () => (window as unknown as { __view: { baseDistance: number } }).__view.baseDistance,
      )
      const nearDistance = nearView / nearB
      expect(nearDistance).toBeGreaterThan(2.1)
      expect(nearDistance).toBeLessThan(2.4)

      // And back out to the far clamp.
      await wheel(page, 350, 70)
      await page.waitForTimeout(1400)
      const farA = await zoom(page)
      await wheel(page, 350, 8)
      await page.waitForTimeout(1400)
      const farB = await zoom(page)
      expect(Math.abs(farB - farA)).toBeLessThan(0.03)
      const farView = await page.evaluate(
        () => (window as unknown as { __view: { baseDistance: number } }).__view.baseDistance,
      )
      const farDistance = farView / farB
      expect(farDistance).toBeGreaterThan(8.2)
      expect(farDistance).toBeLessThan(8.6)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    })

    test('selecting a book keeps rails inside the viewport and the list scrollable', async ({
      page,
    }) => {
      await ready(page)
      await page.evaluate(() => {
        const store = (
          window as unknown as { __atlas: { getState: () => { select: (id: number) => void; focusBook: (id: number) => void } } }
        ).__atlas
        store.getState().select(7)
        store.getState().focusBook(7)
      })
      await page.waitForTimeout(2200)

      const rails = await page.evaluate(() =>
        ['.rail-left', '.rail-right'].map((selector) => {
          const node = document.querySelector<HTMLElement>(selector)
          if (!node) return null
          const rect = node.getBoundingClientRect()
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        }),
      )
      for (const rail of rails) {
        if (!rail) continue
        expect(rail.left).toBeGreaterThanOrEqual(-1)
        expect(rail.top).toBeGreaterThanOrEqual(-1)
        expect(rail.right).toBeLessThanOrEqual(size.width + 1)
        expect(rail.bottom).toBeLessThanOrEqual(size.height + 1)
      }

      const list = await page.evaluate(() => {
        const node = document.querySelector<HTMLElement>('.nearby-list')
        if (!node) return null
        return {
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          overflowY: getComputedStyle(node).overflowY,
        }
      })
      expect(list).not.toBeNull()
      expect(list!.overflowY).toBe('auto')
      expect(list!.scrollHeight).toBeGreaterThan(list!.clientHeight)

      // Ring values must sit inside their rings.
      const overflow = await page.evaluate(() => {
        const values = [...document.querySelectorAll<HTMLElement>('.sim-ring-value')]
        return values
          .map((value) => {
            const ring = value.closest<HTMLElement>('.sim-ring')
            if (!ring) return 0
            const a = value.getBoundingClientRect()
            const b = ring.getBoundingClientRect()
            return Math.max(b.left - a.left, b.top - a.top, a.right - b.right, a.bottom - b.bottom)
          })
          .filter((n) => n > 0.5).length
      })
      expect(overflow).toBe(0)

      await page.screenshot({ path: `artifacts/pw-${size.width}x${size.height}-selected.png` })
    })
  })
}
