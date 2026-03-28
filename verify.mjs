import { chromium } from "playwright";
import * as path from 'path';

async function verify_feature(page) {
  await page.goto("http://localhost:5173");
  await page.waitForTimeout(500);

  // Login as admin
  await page.getByRole("button", { name: "Entrar como Administrador" }).click();
  await page.waitForTimeout(500);

  // Create a new purchase
  await page.getByRole("button", { name: "Nueva Compra" }).click();
  await page.waitForTimeout(500);
  
  await page.getByLabel("Nombre de la Compra (ej. Compra 1)").fill("Compra Marzo");
  await page.getByLabel("Fecha").fill("2024-03-24");
  await page.getByLabel("Tipo de Cambio (CLP a Bs)").fill("96");
  await page.getByLabel("Costo de Pilotaje (Bs)").fill("10");
  
  await page.getByRole("button", { name: "Crear Compra" }).click();
  await page.waitForTimeout(1000); // wait for redirect to detail view

  // Add a product
  await page.getByLabel("Nombre del Producto").fill("Perfume Chanel");
  await page.getByLabel("Unidades").fill("8");
  await page.getByLabel("Precio Compra (Bs)").fill("100");
  await page.getByLabel("Precio Venta (x Mayor)").fill("150");
  await page.getByLabel("Precio Venta (Unidad)").fill("200");
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Guardar Producto" }).click();
  await page.waitForTimeout(1000); // wait for product to render

  await page.screenshot({ path: "/home/jules/verification/verification.png", fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordVideo: { dir: "/home/jules/verification/video" } });
  const page = await context.newPage();
  try {
    await verify_feature(page);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await context.close();
    await browser.close();
  }
})();