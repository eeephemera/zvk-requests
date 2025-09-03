export type SortOrder = 'asc' | 'desc';

export type Column<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right';
  className?: string;
  accessor?: (row: T) => React.ReactNode;
  cell?: (row: T) => React.ReactNode;
};

export type DataTableProps<T> = {
  columns: Array<Column<T>>;
  data: T[];
  isLoading?: boolean;
  skeletonRows?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (columnId: string) => void;
  getRowKey: (row: T) => string | number;
  tableLabel?: string;
  persistKey?: string; // localStorage key for saving settings
  enableColumnVisibilityToggle?: boolean;
};


