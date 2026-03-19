import { test, expect } from 'playwright/test';

test('buys seeds plants matures harvests claims task reward and opens leaderboard', async ({ page, request }) => {
  await page.goto('/');

  const displayName = `农场循环${Date.now()}`;
  await page.getByRole('button', { name: '没有账号？去注册' }).click();
  await page.getByLabel('昵称').fill(displayName);
  await page.getByLabel('密码').fill('pw123456');
  await page.getByRole('button', { name: '注册' }).click();
  await expect(page.getByText('我的农场')).toBeVisible();

  await page.getByRole('button', { name: '商店' }).click();
  await page.getByRole('button', { name: '购买 玉米种子' }).click();

  await page.getByRole('button', { name: '农场' }).click();
  await page.getByRole('button', { name: '地块 1' }).click();
  await page.getByRole('button', { name: '播种' }).click();

  await request.post('http://127.0.0.1:3000/test/mature-slot', {
    data: {
      displayName,
      slotIndex: 0,
    },
  });

  await page.getByRole('button', { name: '刷新农场' }).click();
  await page.getByRole('button', { name: '地块 1' }).click();
  await page.getByRole('button', { name: '收获' }).click();

  await page.getByRole('button', { name: '任务' }).click();
  await page.getByRole('button', { name: '领取 新手种下第一株作物' }).click();

  await page.getByRole('button', { name: '排行' }).click();
  await expect(page.getByText('金币排行榜')).toBeVisible();
});
