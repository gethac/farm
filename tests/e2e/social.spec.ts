import { test, expect } from 'playwright/test';

test('adds a friend visits the friend farm helps and steals', async ({ browser, request }) => {
  const userA = `农友A${Date.now()}`;
  const userB = `农友B${Date.now()}`;

  await request.post('http://127.0.0.1:3000/auth/register', { data: { displayName: userA, password: 'pw123456' } });
  await request.post('http://127.0.0.1:3000/auth/register', { data: { displayName: userB, password: 'pw123456' } });
  await request.post('http://127.0.0.1:3000/test/grant-friendship', { data: { displayNameA: userA, displayNameB: userB } });
  await request.post('http://127.0.0.1:3000/test/mature-slot', { data: { displayName: userB, slotIndex: 0, state: 'growing' } });
  await request.post('http://127.0.0.1:3000/test/mature-slot', { data: { displayName: userB, slotIndex: 1, state: 'mature' } });

  const page = await browser.newPage();
  await page.goto('/');
  await page.getByLabel('昵称').fill(userA);
  await page.getByLabel('密码').fill('pw123456');
  await page.getByRole('button', { name: '登录' }).click();

  await page.getByRole('button', { name: '好友' }).click();
  await expect(page.getByRole('button', { name: `访问 ${userB}` })).toBeVisible();
  await page.getByRole('button', { name: `访问 ${userB}` }).click();

  await page.getByRole('button', { name: '地块 1' }).click();
  await page.getByRole('button', { name: '帮忙' }).click();

  await page.getByRole('button', { name: '地块 2' }).click();
  await page.getByRole('button', { name: '偷菜' }).click();

  await expect(page.getByText('好友农场')).toBeVisible();
});
