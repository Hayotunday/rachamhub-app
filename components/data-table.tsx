"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Edit2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import OrderSearchFilter from "@/components/order-search-filter";

export type DataTableCellValue =
  | string
  | number
  | React.ReactNode
  | {
      primary?: React.ReactNode;
      secondary?: React.ReactNode;
      value?: React.ReactNode;
      detail?: React.ReactNode;
    };

export type DataTableRow = Record<string, DataTableCellValue | undefined>;

export type DataTableColumn = {
  key: string;
  label: string;
  width?: number | string;
  resizable?: boolean;
  editable?: boolean;
  type?: "text" | "select" | "textarea";
  options?: string[];
  longText?: boolean;
  getSearchableText?: (row: DataTableRow) => string;
  render?: (
    row: DataTableRow,
    // The `rowIndex` and `isEditing` parameters are not used in this context, but are kept for compatibility.
    rowIndex: number,
    isEditing: boolean,
    editRow: DataTableRow | null,
    openDialog?: (content: string) => void,
  ) => React.ReactNode;
  className?: string;
};

interface DataTableProps {
  title?: string;
  headers: Array<string | DataTableColumn>;
  rows: DataTableRow[];
  showActions?: boolean;
  actionLabel?: string;
  rowKey?: string;
  onRowSave?: (row: DataTableRow) => Promise<void> | void;
  searchPlaceholder?: string;
  secondarySearchPlaceholder?: string;
  disableSearch?: boolean;
  renderRowActions?: (
    row: DataTableRow,
    rowIndex: number,
    isEditing: boolean,
    editRow: DataTableRow | null,
  ) => React.ReactNode;
  merchantOptions?: string[];
  filterMerchant?: string | null;
  onFilterMerchantChange?: (v: string | null) => void;
  /**
   * Called with `true` when the user starts editing a row or types into the
   * search / filter box, and `false` when they finish (save, cancel, clear).
   * Use this to temporarily pause realtime subscriptions while the table is
   * being interacted with, then resume once they are done.
   */
  onUserActivityChange?: (active: boolean) => void;
  /** The number of rows to request from the server. Displayed in the search bar as a limit selector. */
  dataLimit?: number;
  onDataLimitChange?: (limit: number) => void;
  /** Total count of matching records in the database (may exceed the fetched rows). */
  totalCount?: number;
}

type DialogContext = {
  rowIndex: number;
  columnKey: string;
  content: string;
  editable: boolean;
};

const normalizeColumn = (column: string | DataTableColumn): DataTableColumn =>
  typeof column === "string"
    ? {
        key: column,
        label: column,
        resizable: true,
        editable: false,
        type: "text",
      }
    : {
        resizable: true,
        editable: false,
        type: "text",
        ...column,
      };

const isDataTableCellObject = (
  value: DataTableCellValue,
): value is {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  value?: React.ReactNode;
  detail?: React.ReactNode;
} =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  ("primary" in value ||
    "secondary" in value ||
    "value" in value ||
    "detail" in value);

const getCellPrimary = (value: DataTableCellValue) => {
  if (value == null) return "";
  if (isDataTableCellObject(value)) {
    return value.primary ?? value.value ?? value.detail ?? "";
  }

  return value;
};

const getCellSecondary = (value: DataTableCellValue) => {
  if (value == null) return undefined;
  if (isDataTableCellObject(value)) {
    return value.secondary ?? value.detail ?? undefined;
  }

  return undefined;
};

const makeSearchString = (row: DataTableRow, columns: DataTableColumn[]) => {
  return columns
    .map((column) => {
      // For each column, determine its searchable text
      if (column.getSearchableText) {
        // If a custom searchable text function is provided, use it
        return column.getSearchableText(row);
      }
      // Otherwise, fall back to extracting primary and secondary text from the row value
      const value = row[column.key]; // Get the raw value from the row
      const primary = getCellPrimary(value); // Extract primary text
      const secondary = getCellSecondary(value); // Extract secondary text
      return `${primary ?? ""} ${secondary ?? ""}`;
    })
    .join(" ")
    .toLowerCase();
};

export default function DataTable({
  title,
  headers,
  rows,
  showActions = false,
  actionLabel = "Actions",
  rowKey = "id",
  onRowSave,
  searchPlaceholder = "Search rows...",
  secondarySearchPlaceholder,
  disableSearch = false,
  merchantOptions = [],
  filterMerchant = null,
  onFilterMerchantChange = () => {},
  renderRowActions,
  onUserActivityChange,
  dataLimit,
  onDataLimitChange,
  totalCount,
}: DataTableProps) {
  const columns = useMemo(() => headers.map(normalizeColumn), [headers]);
  const serialColumnWidth = "64px";

  const [tableRows, setTableRows] = useState<DataTableRow[]>(rows);
  const [searchText, setSearchText] = useState("");
  const [secondarySearchText, setSecondarySearchText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<DataTableRow | null>(null);
  const [manualRealtimeEnabled, setManualRealtimeEnabled] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            if (totalCount !== undefined && totalCount > rows.length && onDataLimitChange) {
              onDataLimitChange((dataLimit || rows.length) + 100);
            }
          }
        },
        { root: scrollContainerRef.current, rootMargin: "100px" }
      );
      observerRef.current.observe(node);
    },
    [totalCount, rows.length, onDataLimitChange, dataLimit]
  );
  const topDummyScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [showStickyScroll, setShowStickyScroll] = useState(false);
  const isSyncingRef = useRef(false);

  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        column.width ? String(column.width) : "180px",
      ]),
    ),
  );

  // Synchronize content width and detect if horizontal scroll is needed
  const updateScrollDimensions = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      setContentWidth(scrollWidth);
      setShowStickyScroll(scrollWidth > clientWidth);
    }
  }, []);

  useEffect(() => {
    updateScrollDimensions();
    window.addEventListener("resize", updateScrollDimensions);
    return () => window.removeEventListener("resize", updateScrollDimensions);
  }, [updateScrollDimensions, tableRows, columns, columnWidths]);

  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    const target = e.currentTarget;
    isSyncingRef.current = true;
    if (topDummyScrollRef.current)
      topDummyScrollRef.current.scrollLeft = target.scrollLeft;
  };

  const handleTopDummyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    const target = e.currentTarget;
    isSyncingRef.current = true;
    if (scrollContainerRef.current)
      scrollContainerRef.current.scrollLeft = target.scrollLeft;
  };

  // Removed drag-to-scroll state and logic to disable grab and pull scroll functionality.
  // const [isDragging, setIsDragging] = useState(false);
  // const dragStartRef = useRef({ x: 0, scrollLeft: 0 });

  const [dialogContext, setDialogContext] = useState<DialogContext | null>(
    null,
  );
  const resizingRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

  useEffect(() => {
    const hasActivity =
      editingIndex !== null ||
      searchText.trim().length > 0 ||
      secondarySearchText.trim().length > 0 ||
      filterMerchant !== null;
    const shouldPause = hasActivity || !manualRealtimeEnabled;
    onUserActivityChange?.(shouldPause);
  }, [
    editingIndex,
    searchText,
    secondarySearchText,
    filterMerchant,
    manualRealtimeEnabled,
    onUserActivityChange,
  ]);

  useEffect(() => {
    setColumnWidths(
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          column.width ? String(column.width) : "180px",
        ]),
      ),
    );
  }, [columns]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      event.preventDefault();
      const { key, startX, startWidth } = resizingRef.current;
      const delta = event.clientX - startX;
      const nextWidth = Math.max(80, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [key]: `${nextWidth}px` }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const filteredRows = useMemo(() => {
    let result = tableRows;
    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase();
      result = result.filter((row) =>
        makeSearchString(row, columns).includes(query),
      );
    }
    if (secondarySearchText.trim()) {
      const query = secondarySearchText.trim().toLowerCase();
      result = result.filter((row) =>
        makeSearchString(row, columns).includes(query),
      );
    }
    return result;
  }, [columns, searchText, secondarySearchText, tableRows]);

  // ---------- activity-aware edit / search helpers ----------

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditRow({ ...filteredRows[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditRow(null);
  };

  const saveEdit = async () => {
    if (editingIndex === null || editRow == null) return;
    const actualIndex = tableRows.findIndex((row, index) => {
      const currentId = row[rowKey] ?? index;
      const editingRowId = filteredRows[editingIndex][rowKey] ?? editingIndex;
      return String(currentId) === String(editingRowId);
    });

    if (actualIndex === -1) return;
    const nextRows = [...tableRows];
    nextRows[actualIndex] = editRow;
    setTableRows(nextRows);
    setEditingIndex(null);
    setEditRow(null);

    if (onRowSave) {
      await onRowSave(nextRows[actualIndex]);
    }
  };

  const openDialog = (
    rowIndex: number,
    columnKey: string,
    content: string,
    editable: boolean,
  ) => {
    setDialogContext({ rowIndex, columnKey, content, editable });
  };

  const closeDialog = () => setDialogContext(null);

  const handleDialogSave = () => {
    if (!dialogContext || editingIndex === null || !editRow) return;
    setEditRow((prev) =>
      prev
        ? {
            ...prev,
            [dialogContext.columnKey]: dialogContext.content,
          }
        : null,
    );
    closeDialog();
  };

  const handleCellChange = (columnKey: string, value: DataTableCellValue) => {
    setEditRow((prev) => (prev ? { ...prev, [columnKey]: value } : prev));
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
  };

  const handleMerchantFilterChange = (value: string | null) => {
    onFilterMerchantChange(value);
  };

  const renderCellContent = (
    row: DataTableRow,
    column: DataTableColumn,
    rowIndex: number,
    isEditing: boolean,
  ) => {
    if (column.render) {
      return column.render(
        row,
        rowIndex,
        isEditing,
        editRow,
        (content: string) => openDialog(rowIndex, column.key, content, false),
      );
    }

    const value = isEditing && editRow ? editRow[column.key] : row[column.key];
    const primary = getCellPrimary(value);
    const secondary = getCellSecondary(value);
    const textValue = String(primary ?? "");
    // Automatically treat text longer than 40 characters as "long text"
    const isLongText =
      column.longText || column.type === "textarea" || textValue.length > 40;

    if (isEditing && column.editable) {
      if (column.type === "select" && Array.isArray(column.options)) {
        return (
          <Select
            value={textValue}
            onValueChange={(val) => handleCellChange(column.key, val)}
          >
            <SelectTrigger className="w-full text-left">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {column.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      // Inline editing: use Textarea for long text and Input for normal text
      if (column.type === "textarea" || isLongText) {
        return (
          <Textarea
            value={textValue}
            onChange={(event) =>
              handleCellChange(column.key, event.target.value)
            }
            className="text-xs min-h-20 p-2"
          />
        );
      }

      return (
        <Input
          value={textValue}
          onChange={(event) => handleCellChange(column.key, event.target.value)}
          className="w-full"
        />
      );
    }

    const displayContent = (
      <div className="text-xs py-1 wrap-anywhere whitespace-normal w-full">
        <div className="wrap-anywhere whitespace-normal">{primary}</div>
        {secondary ? (
          <div className="text-[10px] text-muted-foreground wrap-anywhere whitespace-normal">
            {secondary}
          </div>
        ) : null}
      </div>
    );

    // For long text, allow opening a dialog to see/edit in a larger Textarea
    if (isLongText) {
      return (
        <button
          type="button"
          className="text-left w-full hover:bg-muted/40 transition-colors rounded p-1 wrap-anywhere whitespace-normal"
          onClick={() => openDialog(rowIndex, column.key, textValue, false)}
        >
          {displayContent}
        </button>
      );
    }

    return displayContent;
  };

  return (
    <div className="space-y-4">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}

      {!disableSearch ? (
        <OrderSearchFilter
          searchTerm={searchText}
          onSearchTermChange={handleSearchChange}
          secondarySearchTerm={secondarySearchText}
          onSecondarySearchTermChange={setSecondarySearchText}
          placeholder={searchPlaceholder}
          secondaryPlaceholder={secondarySearchPlaceholder}
          merchantOptions={merchantOptions}
          filterMerchant={filterMerchant}
          onFilterMerchantChange={handleMerchantFilterChange}
          dataLimit={dataLimit}
          onDataLimitChange={onDataLimitChange}
          realtimeEnabled={manualRealtimeEnabled}
          onRealtimeToggle={
            onUserActivityChange ? setManualRealtimeEnabled : undefined
          }
        />
      ) : null}

      <div className="relative border rounded-md bg-background h-110 flex flex-col overflow-hidden shadow-sm">
        {/* Top Sticky Horizontal Scrollbar 
        {showStickyScroll && (
          <div
            ref={topDummyScrollRef}
            onScroll={handleTopDummyScroll}
            className="overflow-x-auto z-40 bg-background border-b border-border h-3 w-full shrink-0 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
          >
            <div style={{ width: contentWidth, height: "1px" }} />
          </div>
        )}
        */}

        <div
          ref={scrollContainerRef}
          onScroll={handleMainScroll}
          className="flex-1 overflow-auto select-none [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-0 [-ms-overflow-style:none] scrollbar-thin relative"
        >
          <table className="table-fixed w-full border-collapse relative">
            <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
              <TableRow>
                <th
                  style={{
                    width: serialColumnWidth,
                    minWidth: serialColumnWidth,
                  }}
                  className="relative overflow-hidden border-r border-border h-10 px-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle"
                >
                  S/N
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      width: columnWidths[column.key],
                      minWidth: "80px",
                    }}
                    className="relative overflow-hidden border-r border-border h-10 px-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle"
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                    </div>
                    {column.resizable ? (
                      <div
                        role="separator"
                        onMouseDown={(event) => {
                          resizingRef.current = {
                            key: column.key,
                            startX: event.clientX,
                            startWidth:
                              Number(
                                columnWidths[column.key]?.replace("px", ""),
                              ) || 180,
                          };
                        }}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      />
                    ) : null}
                  </th>
                ))}
                {showActions ? (
                  <th className="relative text-left border-r border-border h-10 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24 align-middle">
                    {actionLabel}
                  </th>
                ) : null}
              </TableRow>
            </thead>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      columns.length +
                      1 +
                      (showActions || renderRowActions ? 1 : 0)
                    }
                    className="h-24 text-center text-muted-foreground text-xs"
                  >
                    No orders available to be displayed
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, rowIndex) => {
                  const isEditing = editingIndex === rowIndex;
                  const rowId = row[rowKey] ?? rowIndex;
                  return (
                    <TableRow
                      key={String(rowId)}
                      className="hover:bg-muted/20 transition-colors border-b border-border group"
                    >
                      <TableCell
                        style={{
                          width: serialColumnWidth,
                          minWidth: serialColumnWidth,
                        }}
                        className="border-r border-border py-1.5 px-3 group-hover:bg-transparent bg-white text-xs font-semibold text-muted-foreground"
                      >
                        {rowIndex + 1}
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={`${String(rowId)}-${column.key}`}
                          style={{
                            width: columnWidths[column.key],
                            minWidth: "80px",
                          }}
                          className="border-r border-border py-1.5 px-3 group-hover:bg-transparent bg-white overflow-hidden max-w-0 wrap-anywhere whitespace-normal"
                        >
                          {renderCellContent(row, column, rowIndex, isEditing)}
                        </TableCell>
                      ))}
                      {renderRowActions ? (
                        <TableCell className="text-left bg-white group-hover:bg-transparent border-r border-border w-24">
                          {renderRowActions(row, rowIndex, isEditing, editRow)}
                        </TableCell>
                      ) : showActions ? (
                        <TableCell className="text-left bg-white group-hover:bg-transparent border-r border-border w-24">
                          {isEditing ? (
                            <div className="flex justify-start gap-2">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={saveEdit}
                              >
                                <Check className="h-4 w-4 text-emerald-500" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={cancelEditing}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-start gap-2">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => startEditing(rowIndex)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
              {totalCount !== undefined && rows.length < totalCount && onDataLimitChange && (
                <TableRow ref={loadMoreRef}>
                  <TableCell
                    colSpan={
                      columns.length +
                      1 +
                      (showActions || renderRowActions ? 1 : 0)
                    }
                    className="h-4 p-0 opacity-0"
                  />
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </div>

      {totalCount !== undefined && (
        <div className="flex justify-center p-2 border-t border-border bg-white rounded-b-xl text-xs text-muted-foreground font-medium">
          Showing {rows.length} of {totalCount} records
          {rows.length < totalCount && (
            <span className="ml-1 animate-pulse">(scrolling to load more...)</span>
          )}
        </div>
      )}

      <Dialog
        open={Boolean(dialogContext)}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Details</DialogTitle>
            <DialogDescription>
              {dialogContext?.editable
                ? "Update the selected field and save the value."
                : "Review the full field content."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {dialogContext?.editable ? (
              <Textarea
                value={dialogContext.content}
                onChange={(event) =>
                  setDialogContext((prev) =>
                    prev ? { ...prev, content: event.target.value } : prev,
                  )
                }
                className="min-h-40"
              />
            ) : (
              <Textarea
                readOnly
                value={dialogContext?.content}
                className="min-h-60 bg-muted/30 font-mono text-xs"
              />
            )}
          </div>

          <DialogFooter>
            {dialogContext?.editable ? (
              <Button onClick={handleDialogSave}>Save</Button>
            ) : null}
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
