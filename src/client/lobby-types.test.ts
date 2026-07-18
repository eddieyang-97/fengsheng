import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTO_PASS_DELAY_MS,
  parseAutoPassDelayPreference,
} from "./lobby-types";

describe("个人自动跳过等待设置", () => {
  it("没有本地设置或本地值无效时使用一秒", () => {
    expect(parseAutoPassDelayPreference(null)).toBe(DEFAULT_AUTO_PASS_DELAY_MS);
    expect(parseAutoPassDelayPreference("750")).toBe(DEFAULT_AUTO_PASS_DELAY_MS);
    expect(parseAutoPassDelayPreference("not-a-number")).toBe(
      DEFAULT_AUTO_PASS_DELAY_MS,
    );
  });

  it.each(["0", "500", "1000", "2000", "3000", "5000"])(
    "恢复支持的个人等待时间 %s 毫秒",
    (stored) => {
      expect(parseAutoPassDelayPreference(stored)).toBe(Number(stored));
    },
  );
});
