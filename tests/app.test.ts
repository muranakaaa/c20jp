import { describe, expect, test } from "bun:test";
import { app } from "../src/app";

describe("app", () => {
  test("記事ページを 200 で返し、原本のタイトルを含む", async () => {
    const res = await app.request("http://localhost/1945/08hiros.html");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div class="title">アメリカ軍、広島に原爆投下</div>');
  });

  test("トップページを 200 で返す", async () => {
    const res = await app.request("http://localhost/index.html");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("クリック２０世紀");
  });

  test("存在しないルートは 404", async () => {
    const res = await app.request("http://localhost/nonexistent.html");
    expect(res.status).toBe(404);
  });
});
