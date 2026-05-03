export function getProductImageUrl(productName: string): string {
  // Files are stored in public/product-photos with filename matching product name.
  return `/product-photos/${encodeURIComponent(productName)}.jpg`;
}
