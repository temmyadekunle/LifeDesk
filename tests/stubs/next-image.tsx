// Stands in for next/image, which is a bundler alias with no resolvable
// file path and therefore cannot be imported outside a Next build. Only
// the props this test cares about are forwarded; the point is to render
// real components, not to reproduce image optimisation.
type ImgProps = {
  src: string | { src: string };
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fill?: boolean;
};

export default function Image({
  src,
  alt = "",
  width,
  height,
  ...rest
}: ImgProps) {
  // priority and fill are Next-only concerns with no bearing on the
  // rendered text, so they are dropped along with the props below.
  delete rest.priority;
  delete rest.fill;

  const resolved = typeof src === "string" ? src : src.src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} width={width} height={height} {...rest} />;
}