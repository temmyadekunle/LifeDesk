import test from "node:test";

import { assert } from "./helpers.ts";

import {
  AVATAR_MAX_CHARS,
  AVATAR_MAX_EDGE,
  avatarCrop,
  isAvatarDataUrl,
} from "../lib/avatar.ts";
import { DEFAULT_SETTINGS } from "../lib/settings.ts";

/** A syntactically valid picture. The bytes are not a real image, and nothing
    under test decodes them: these tests are about the guards, not the codec. */
function fakeImage(type = "image/webp"): string {
  return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB`;
}

test("avatarCrop", async (t) => {
  await t.test("takes the largest square that fits", () => {
    assert.equal(avatarCrop(400, 900).side, AVATAR_MAX_EDGE);
  });

  await t.test("centres the crop on a tall portrait", () => {
    // 900 tall, 400 wide. The square is limited by the cap, not by the short
    // edge, and equal bands come off the top and bottom so a face near the
    // middle of the frame survives.
    const { sx, sy, side } = avatarCrop(400, 900);
    assert.equal(side, AVATAR_MAX_EDGE);
    assert.equal(sx, 72);
    assert.equal(sy, 322);
  });

  await t.test("centres the crop on a wide photo", () => {
    const { sx, sy, side } = avatarCrop(900, 400);
    assert.equal(side, AVATAR_MAX_EDGE);
    assert.equal(sx, 322);
    assert.equal(sy, 72);
  });

  await t.test("crops a square down to the cap", () => {
    assert.deepEqual(avatarCrop(300, 300), { sx: 22, sy: 22, side: 256 });
  });

  await t.test("does not upscale a small image", () => {
    // Growing a 48px thumbnail would invent pixels and make it blurry.
    assert.equal(avatarCrop(48, 48).side, 48);
  });

  await t.test("never crops wider than the short edge", () => {
    // The bug this replaced: taking the long edge produced a square wider than
    // the image and a negative offset on the short axis.
    assert.equal(avatarCrop(20, 40).side, 20);
    assert.equal(avatarCrop(3, 7).side, 3);
    assert.equal(avatarCrop(1000, 3).sy, 0);
  });

  await t.test("stays inside the source on both axes", () => {
    for (const [w, h] of [[1, 1], [3, 7], [64, 65], [1000, 3], [7, 1000]]) {
      const { sx, sy, side } = avatarCrop(w, h);
      assert.ok(sx >= 0 && sy >= 0, `crop starts outside the image for ${w}x${h}`);
      assert.ok(sx + side <= w, `crop runs past the width for ${w}x${h}`);
      assert.ok(sy + side <= h, `crop runs past the height for ${w}x${h}`);
    }
  });

  await t.test("honours a smaller cap", () => {
    assert.equal(avatarCrop(1000, 1000, 64).side, 64);
  });
});

test("isAvatarDataUrl", async (t) => {
  await t.test("accepts the formats the encoder produces", () => {
    assert.ok(isAvatarDataUrl(fakeImage("image/webp")));
    assert.ok(isAvatarDataUrl(fakeImage("image/png")));
    assert.ok(isAvatarDataUrl(fakeImage("image/jpeg")));
  });

  await t.test("rejects an empty or missing picture", () => {
    assert.equal(isAvatarDataUrl(""), false);
    assert.equal(isAvatarDataUrl(undefined), false);
    assert.equal(isAvatarDataUrl(null), false);
  });

  await t.test("rejects anything that is not a stored picture", () => {
    // The value comes out of storage and off the network, so it is untrusted.
    assert.equal(isAvatarDataUrl("javascript:alert(1)"), false);
    assert.equal(isAvatarDataUrl("<script>"), false);
    assert.equal(isAvatarDataUrl("/uploads/me.png"), false);
    assert.equal(isAvatarDataUrl("data:text/html;base64,PHNjcmlwdD4="), false);
    assert.equal(isAvatarDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
    assert.equal(isAvatarDataUrl(42), false);
  });

  await t.test("rejects a non-base64 payload", () => {
    assert.equal(isAvatarDataUrl("data:image/webp,rawbytes"), false);
  });

  await t.test("refuses a payload too large to be a thumbnail", () => {
    // A data URL this size is not something readAvatar produced, so it is either
    // corrupt or an attempt to push a large blob through the sync payload.
    assert.equal(isAvatarDataUrl(`data:image/webp;base64,${"A".repeat(AVATAR_MAX_CHARS)}`), false);
  });
});

test("default settings", async (t) => {
  await t.test("have no picture, so the app falls back to initials", () => {
    assert.equal(DEFAULT_SETTINGS.avatar, "");
    assert.equal(isAvatarDataUrl(DEFAULT_SETTINGS.avatar), false);
  });
});
