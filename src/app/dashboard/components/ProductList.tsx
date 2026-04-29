// components/dashboard/ProductListClient.tsx
"use client";

import ProductList from "./ProductList";
import type { PropertyDB, PaginationData } from "@/lib/db";

export default function ProductListClient({
  properties,
  pagination,
}: {
  properties: PropertyDB[];
  pagination: PaginationData;
}) {
  return <ProductList initialData={properties} pagination={pagination} />;
}
