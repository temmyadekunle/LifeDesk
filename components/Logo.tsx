import Image from "next/image";

/**
 * The single place the brand mark is rendered.
 *
 * Three surfaces need it at very different sizes: the onboarding hero, the
 * persistent app bar, and the profile screen. Keeping the path in one constant
 * means swapping the artwork is a one-line change here rather than a hunt
 * through three components, and it keeps the alt text consistent for screen
 * readers.
 *
 * Sizes are expressed as a height with automatic width rather than a fixed
 * box, so an image of any aspect ratio renders undistorted. An earlier version
 * centre-cropped to a square, which is fine for an icon but destroys a
 * wordmark, and this artwork has been a 3:2 landscape photo.
 */

/**
 * Source artwork. Replace the file, or point this at a new path.
 * This is the 256px PNG that scripts/make-favicons.mjs renders from
 * public/logo.jpeg; the original JPEG stays in public/ as that script's
 * input. The generated file must exist — a path that 404s renders a broken
 * image in the app bar and onboarding, and nothing else complains.
 */
export const LOGO_SRC = "/logo-256.png";

/** Intrinsic size of the rendered source artwork. */
export const LOGO_WIDTH = 256;
export const LOGO_HEIGHT = 256;

/** Rendered height of the small mark, in px. */
const MARK_PX = 32;
/** Rendered width of the onboarding lockup, in px. */
const WORDMARK_PX = 88;

export function Logo({
  variant = "mark",
  priority = false,
  alt = "Livanta",
}: {
  variant?: "mark" | "wordmark";
  priority?: boolean;
  alt?: string;
}) {
  if (variant === "wordmark") {
    return (
      <Image
        src={LOGO_SRC}
        alt={alt}
        width={WORDMARK_PX}
        height={Math.round((WORDMARK_PX * LOGO_HEIGHT) / LOGO_WIDTH)}
        priority={priority}
        className="logo logo--wordmark"
      />
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={Math.round((MARK_PX * LOGO_WIDTH) / LOGO_HEIGHT)}
      height={MARK_PX}
      priority={priority}
      className="logo logo--mark"
    />
  );
}