"use client";

import { useState } from "react";
import { Search, X, AlertTriangle, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export interface Country {
  id: string;
  name: string;
  code: string;
  region: string;
  complexRules: boolean;
}

interface GeoSelectorProps {
  countries: Country[];
  loading: boolean;
  selectedCountries: string[];
  onChange: (ids: string[]) => void;
}

const REGION_LABELS: Record<string, string> = {
  NORTH_AMERICA: "North America",
  LATIN_AMERICA: "Latin America",
  EUROPEAN_UNION: "European Union",
  EUROPE_OTHER: "Europe (Other)",
  UNITED_KINGDOM: "United Kingdom",
  MIDDLE_EAST_AFRICA: "Middle East & Africa",
  ASIA_PACIFIC: "Asia Pacific",
  OCEANIA: "Oceania",
  SOUTH_ASIA: "South Asia",
};

function groupByRegion(countries: Country[]): Map<string, Country[]> {
  const map = new Map<string, Country[]>();
  for (const c of countries) {
    if (!map.has(c.region)) map.set(c.region, []);
    map.get(c.region)!.push(c);
  }
  return map;
}

export function GeoSelector({
  countries,
  loading,
  selectedCountries,
  onChange,
}: GeoSelectorProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (loading) {
    return <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />;
  }

  if (!countries.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 gap-2">
        <Globe className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-400 text-center">
          No countries are approved yet. Contact your administrator.
        </p>
      </div>
    );
  }

  const filtered = search
    ? countries.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : countries;

  const grouped = groupByRegion(filtered);

  function toggle(id: string) {
    if (selectedCountries.includes(id)) {
      onChange(selectedCountries.filter((c) => c !== id));
    } else {
      onChange([...selectedCountries, id]);
    }
  }

  function toggleRegion(regionCountries: Country[]) {
    const ids = regionCountries.map((c) => c.id);
    const allSelected = ids.every((id) => selectedCountries.includes(id));
    if (allSelected) {
      onChange(selectedCountries.filter((id) => !ids.includes(id)));
    } else {
      const newIds = [...selectedCountries];
      for (const id of ids) {
        if (!newIds.includes(id)) newIds.push(id);
      }
      onChange(newIds);
    }
  }

  function toggleCollapse(region: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  function remove(id: string) {
    onChange(selectedCountries.filter((c) => c !== id));
  }

  const selectedData = countries.filter((c) => selectedCountries.includes(c.id));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Select the countries where this ad will run. Only countries with
        approved compliance data are shown.{" "}
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          Amber
        </span>{" "}
        indicates complex local regulations.
      </p>

      {/* Selected tags */}
      {selectedData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedData.map((country) => (
            <Badge
              key={country.id}
              variant="secondary"
              className={cn(
                "flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm",
                country.complexRules && "border border-amber-300 bg-amber-50 text-amber-800"
              )}
            >
              {country.complexRules && (
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              )}
              <span className="font-mono text-xs text-slate-400">{country.code}</span>
              {country.name}
              <button
                type="button"
                onClick={() => remove(country.id)}
                className="rounded-full hover:bg-slate-300 transition-colors p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search countries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Country list grouped by region */}
      <div className="space-y-2 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {Array.from(grouped.entries()).map(([region, regionCountries]) => {
          const isCollapsed = collapsed.has(region);
          const allSelected = regionCountries.every((c) =>
            selectedCountries.includes(c.id)
          );
          const someSelected = regionCountries.some((c) =>
            selectedCountries.includes(c.id)
          );

          return (
            <div key={region}>
              {/* Region header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate =
                        someSelected && !allSelected;
                    }
                  }}
                  onCheckedChange={() => toggleRegion(regionCountries)}
                  className="border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => toggleCollapse(region)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {REGION_LABELS[region] ?? region}
                  </span>
                  <span className="text-xs text-slate-400">
                    {regionCountries.filter((c) => selectedCountries.includes(c.id))
                      .length}
                    /{regionCountries.length}
                  </span>
                </button>
              </div>

              {/* Countries */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-50">
                  {regionCountries.map((country) => {
                    const isSelected = selectedCountries.includes(country.id);
                    return (
                      <label
                        key={country.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                          isSelected ? "bg-slate-50" : "hover:bg-slate-50/50",
                          country.complexRules && isSelected && "bg-amber-50/50"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(country.id)}
                          className="border-slate-300"
                        />
                        <span className="font-mono text-xs text-slate-400 w-8 shrink-0">
                          {country.code}
                        </span>
                        <span className="text-sm text-slate-700 flex-1">
                          {country.name}
                        </span>
                        {country.complexRules && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200 shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                            Complex rules
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">
            No countries match &ldquo;{search}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
