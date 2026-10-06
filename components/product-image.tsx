"use client";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/types";
export function ProductImage({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={large ? "product-image large" : "product-image"}>
      {failed ? (
        <span className="image-fallback">
          <ImageOff size={large ? 30 : 16} />
          <span>{large ? "Image unavailable" : product.color.slice(0, 2)}</span>
        </span>
      ) : (
        <Image
          src={product.image}
          width={600}
          height={800}
          alt={product.name}
          loading="lazy"
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
