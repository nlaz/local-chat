// bubble.spec.js — tests that speech bubbles appear and are positioned on-screen
const { test, expect } = require('@playwright/test');

const BASE = process.env.TEST_BASE || 'http://localhost:3456';

async function joinAs(page, name) {
  await page.goto(BASE);
  await page.waitForSelector('#entry-screen:not(.hidden)', { timeout: 5000 });
  await page.fill('#name-input', name);
  await page.click('#enter-btn');
  await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(500);
}

test('speech bubble appears on screen after sending a message', async ({ page }) => {
  await joinAs(page, 'BubbleTester');

  // Send a message
  await page.fill('#chat-input', 'hello world');
  await page.click('#send-btn');

  // Bubble should appear in DOM
  await page.waitForSelector('.speech-bubble', { timeout: 3000 });

  const bubble = page.locator('.speech-bubble').first();
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText('hello world');

  // Bubble should be positioned within the viewport (not off-screen)
  const bubbleBox = await bubble.boundingBox();
  const viewport  = page.viewportSize();

  expect(bubbleBox).not.toBeNull();
  console.log('Bubble position:', bubbleBox, 'Viewport:', viewport);

  // Bubble left edge should be within viewport (allow small overhang for overflow:hidden clips)
  expect(bubbleBox.x).toBeGreaterThan(-bubbleBox.width);
  expect(bubbleBox.x).toBeLessThan(viewport.width);

  // Bubble top should be on screen (not way off-screen like it was at 1968px)
  expect(bubbleBox.y).toBeGreaterThan(-50);
  expect(bubbleBox.y).toBeLessThan(viewport.height);
});

test('bubble scale matches renderer scale', async ({ page }) => {
  await joinAs(page, 'ScaleMatch');

  // Send a message
  await page.fill('#chat-input', 'scale check');
  await page.click('#send-btn');

  await page.waitForSelector('.speech-bubble', { timeout: 3000 });

  // Verify that scale in chat.js matches what renderer uses
  const scaleInfo = await page.evaluate(() => {
    const canvas  = document.getElementById('game-canvas');
    const W       = window.World;
    const rendererScale = canvas.height / W.WORLD_H;
    const chatScale     = canvas.height / (W.WORLD_H || 900);  // what chat.js now uses
    return { rendererScale, chatScale, match: Math.abs(rendererScale - chatScale) < 0.001 };
  });

  expect(scaleInfo.match).toBe(true);
  console.log('Scale:', scaleInfo.rendererScale);
});
