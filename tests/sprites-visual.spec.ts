import { test, expect } from '@playwright/test';

test('game map renders with sprites', async ({ page }) => {
  await page.goto('/game/42');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: 'tests/screenshots/game-overview.png' });

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Zoom into land area where cities/units spawn (medium zoom)
  const landX = box!.x + box!.width * 0.35;
  const landY = box!.y + box!.height * 0.3;

  await page.mouse.move(landX, landY);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/game-zoomed.png' });

  // Zoom into city/unit cluster in upper-left land area
  const cityX = box!.x + box!.width * 0.15;
  const cityY = box!.y + box!.height * 0.25;
  await page.mouse.move(cityX, cityY);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/game-closeup.png' });

  console.log('Screenshots saved');
});
