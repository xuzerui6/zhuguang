import type { CSSProperties, ImgHTMLAttributes } from "react";

type NativeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  fill?: boolean;
  priority?: boolean;
  src: string;
};

export default function NativeImage({
  alt = "",
  fill,
  height,
  priority,
  sizes,
  src,
  style,
  width,
  ...props
}: NativeImageProps) {
  const fillStyle: CSSProperties | undefined = fill
    ? {
        height: "100%",
        inset: 0,
        position: "absolute",
        width: "100%",
        ...style,
      }
    : style;

  return (
    <img
      {...props}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      height={fill ? undefined : height}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      src={src}
      style={fillStyle}
      width={fill ? undefined : width}
    />
  );
}
