"use client";

import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";

interface Props {
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  secondarySearchTerm?: string;
  onSecondarySearchTermChange?: (v: string) => void;
  merchantOptions?: string[];
  filterMerchant?: string | null;
  onFilterMerchantChange?: (v: string | null) => void;
  placeholder?: string;
  secondaryPlaceholder?: string;
  title?: string;
  realtimeEnabled?: boolean;
  onRealtimeToggle?: (enabled: boolean) => void;
}

export default function OrderSearchFilter({
  searchTerm,
  onSearchTermChange,
  secondarySearchTerm,
  onSecondarySearchTermChange,
  merchantOptions = [],
  filterMerchant,
  onFilterMerchantChange,
  placeholder = "Search by customer, address, order id or merchant",
  secondaryPlaceholder = "Additional search...",
  title = "Search & Filter",
  realtimeEnabled,
  onRealtimeToggle,
}: Props) {
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [localSecondarySearch, setLocalSecondarySearch] = useState(
    secondarySearchTerm ?? "",
  );

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (secondarySearchTerm !== undefined) {
      setLocalSecondarySearch(secondarySearchTerm);
    }
  }, [secondarySearchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchTermChange(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, onSearchTermChange]);

  useEffect(() => {
    if (onSecondarySearchTermChange) {
      const handler = setTimeout(() => {
        onSecondarySearchTermChange(localSecondarySearch);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [localSecondarySearch, onSecondarySearchTermChange]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <h1 className="text-lg font-semibold text-foreground w-full md:w-auto">
        {title}
      </h1>
      <input
        aria-label="Search orders"
        placeholder={placeholder}
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        className="rounded-md border border-input px-3 py-2 text-sm w-full max-w-md"
      />
      {secondarySearchTerm !== undefined && onSecondarySearchTermChange && (
        <input
          aria-label="Additional search"
          placeholder={secondaryPlaceholder}
          value={localSecondarySearch}
          onChange={(e) => setLocalSecondarySearch(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm w-full max-w-md"
        />
      )}
      {merchantOptions.length > 0 && onFilterMerchantChange && (
        <select
          value={filterMerchant ?? ""}
          onChange={(e) =>
            onFilterMerchantChange(e.target.value ? e.target.value : null)
          }
          className="rounded-md border border-input px-3 py-2 text-sm"
        >
          <option value="">All merchants</option>
          {merchantOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}
      {onRealtimeToggle && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Realtime Updates
          </span>
          <Switch
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-400"
            checked={realtimeEnabled}
            onCheckedChange={onRealtimeToggle}
            aria-label="Toggle realtime updates"
          />
        </div>
      )}
    </div>
  );
}
