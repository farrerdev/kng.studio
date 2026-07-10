import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { ProductImage } from "../../../types/catalog";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { IMAGE_WIDTHS } from "../../storefront/storefrontConstants";
import type { GalleryImage } from "../../storefront/storefrontTypes";

type AdminImageActionFieldProps = {
  image: ProductImage;
  caption: string;
  ariaLabel: string;
  className?: string;
  onPreview: (image: GalleryImage) => void;
  onFileSelected: (file: File) => void;
};

export function AdminImageActionField({
  image,
  caption,
  ariaLabel,
  className,
  onPreview,
  onFileSelected,
}: AdminImageActionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = image.src.trim().length > 0;

  const rootClassName = className ? `pattern-thumb-field ${className}` : "pattern-thumb-field";

  return (
    <div className={hasImage ? rootClassName : `${rootClassName} empty`}>
      <button
        className="thumb-image-button"
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => {
          if (!hasImage) {
            inputRef.current?.click();
            return;
          }
          setIsOpen((current) => !current);
        }}
      >
        {hasImage ? (
          <img
            src={getSupabaseImageSrc(image.src, IMAGE_WIDTHS.adminThumb, 72)}
            alt={image.alt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="thumb-empty-state">
            <Plus size={16} aria-hidden="true" />
          </span>
        )}
      </button>
      {hasImage && isOpen ? (
        <div className="thumb-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onPreview({ ...image, caption });
            }}
          >
            Xem ảnh
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              inputRef.current?.click();
            }}
          >
            Upload ảnh mới
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="thumb-file-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onFileSelected(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
