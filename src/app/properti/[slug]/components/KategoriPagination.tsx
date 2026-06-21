"use client";

import React from "react";
import type { PaginationData } from "../types";
import Pagination from "@/components/Pagination";

interface KategoriPaginationProps {
  pagination: PaginationData;
  onPage: (page: number) => void;
}

export default function KategoriPagination({
  pagination,
  onPage,
}: KategoriPaginationProps) {
  return (
    <Pagination
      currentPage={pagination.currentPage}
      totalPages={pagination.totalPages}
      onPage={onPage}
    />
  );
}
