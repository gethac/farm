import { test, expect } from 'playwright/test';

test('registers logs in and lands on the farm home screen', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '没有账号？去注册' }).click();
  await page.getByLabel('昵称').fill(`农友${Date.now()}`);
  await page.getByLabel('密码').fill('pw123456');
  await page.getByRole('button', { name: '注册' }).click();

  await expect(page.getByRole('button', { name: '地块 1' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: '地块 1' })).toBeVisible();
});
