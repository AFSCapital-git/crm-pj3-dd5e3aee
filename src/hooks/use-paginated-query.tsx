import { useCallback, useRef } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

interface PaginationState<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

interface UsePaginatedQueryOptions {
  pageSize?: number;
}

/**
 * Hook para paginação cursor-based com React Query.
 * Mantém histórico de páginas carregadas.
 *
 * Uso:
 * ```tsx
 * const { items, loadMore, isLoading, hasMore } = usePaginatedQuery({
 *   queryKey: ['empresas-paginated'],
 *   queryFn: (cursor) => listEmpresasPaginado({ cursor, pageSize: 50 }),
 * });
 * ```
 */
export function usePaginatedQuery<T extends { id: string }>(
  queryKey: (string | null)[],
  queryFn: (cursor: string | null, pageSize: number) => Promise<PaginationState<T>>,
  options?: UsePaginatedQueryOptions,
): {
  items: T[];
  loadMore: () => Promise<void>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
} {
  const pageSize = options?.pageSize ?? 50;
  const itemsRef = useRef<T[]>([]);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  // Query untuk halaman pertama
  const firstPageQuery = useQuery({
    queryKey: [...queryKey, null],
    queryFn: () => queryFn(null, pageSize),
  });

  // Query untuk halaman berikutnya (dikontrol manual)
  const nextPageQuery = useQuery({
    queryKey: [...queryKey, cursorRef.current],
    queryFn: () => queryFn(cursorRef.current, pageSize),
    enabled: false, // Tidak auto-fetch
  });

  // Update items ketika halaman pertama berhasil
  if (firstPageQuery.data && itemsRef.current.length === 0) {
    itemsRef.current = firstPageQuery.data.items;
    cursorRef.current = firstPageQuery.data.nextCursor;
    hasMoreRef.current = firstPageQuery.data.hasMore;
  }

  // Tambah items dari halaman berikutnya
  if (nextPageQuery.data) {
    itemsRef.current.push(...nextPageQuery.data.items);
    cursorRef.current = nextPageQuery.data.nextCursor;
    hasMoreRef.current = nextPageQuery.data.hasMore;
  }

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current) return;
    await nextPageQuery.refetch();
  }, [nextPageQuery]);

  return {
    items: itemsRef.current,
    loadMore,
    isLoading: firstPageQuery.isLoading,
    isLoadingMore: nextPageQuery.isFetching,
    hasMore: hasMoreRef.current,
    error: firstPageQuery.error as Error | null,
  };
}

/**
 * Hook para carregar itens infinitos (infinite scroll).
 * Semelhante a usePaginatedQuery, mas automático.
 */
export function useInfinitePaginatedQuery<T extends { id: string }>(
  queryKey: (string | null)[],
  queryFn: (cursor: string | null, pageSize: number) => Promise<PaginationState<T>>,
  options?: UsePaginatedQueryOptions,
) {
  const pageSize = options?.pageSize ?? 50;
  const itemsRef = useRef<T[]>([]);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const query = useQuery({
    queryKey: [...queryKey, cursorRef.current],
    queryFn: () => queryFn(cursorRef.current, pageSize),
  });

  // Update items quando ada data baru
  if (query.data) {
    if (cursorRef.current === null) {
      // Halaman pertama: reset items
      itemsRef.current = query.data.items;
    } else {
      // Halaman berikutnya: append
      itemsRef.current.push(...query.data.items);
    }
    cursorRef.current = query.data.nextCursor;
    hasMoreRef.current = query.data.hasMore;
  }

  const fetchNextPage = useCallback(async () => {
    if (!hasMoreRef.current) return;
    // Force refetch dengan cursor baru
    await query.refetch();
  }, [query]);

  return {
    items: itemsRef.current,
    fetchNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetching && cursorRef.current !== null,
    hasNextPage: hasMoreRef.current,
    error: query.error as Error | null,
  };
}
