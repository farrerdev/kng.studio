import { useCallback, useState, type ImgHTMLAttributes } from "react";

type SmoothImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

// Fades an image in once it has decoded so tiles never flash half-painted; cached images show immediately.
export function SmoothImage({ priority = false, className, onLoad, ...props }: SmoothImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setIsLoaded(true);
  }, []);

  return (
    <img
      {...props}
      ref={imageRef}
      className={["kng-img", isLoaded ? "is-loaded" : "", className ?? ""].join(" ").trim()}
      loading={priority ? "eager" : props.loading ?? "lazy"}
      decoding="async"
      // React 18 does not know fetchPriority yet; the lowercase attribute is passed straight to the DOM.
      {...(priority ? { fetchpriority: "high" } : {})}
      onLoad={(event) => {
        setIsLoaded(true);
        onLoad?.(event);
      }}
      onError={() => setIsLoaded(true)}
    />
  );
}

const preloadedSources = new Set<string>();

// Warm the browser cache for the next screen's hero image (e.g. on card hover/touch).
export function preloadImage(src: string | undefined, srcSet?: string, sizes?: string) {
  if (!src || preloadedSources.has(src)) return;
  preloadedSources.add(src);
  const image = new Image();
  if (sizes) image.sizes = sizes;
  if (srcSet) image.srcset = srcSet;
  image.src = src;
}
