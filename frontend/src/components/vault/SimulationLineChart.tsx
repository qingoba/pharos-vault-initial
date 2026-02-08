'use client';

import { useMemo } from 'react';

interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

interface SimulationLineChartProps {
  series: LineSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

function buildPath(
  values: number[],
  width: number,
  height: number,
  minValue: number,
  maxValue: number
): string {
  if (values.length === 0) {
    return '';
  }

  const xStep = values.length > 1 ? width / (values.length - 1) : width;
  const valueRange = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x = index * xStep;
      const y = height - ((value - minValue) / valueRange) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function SimulationLineChart({
  series,
  height = 180,
  valueFormatter = (value) => value.toFixed(2),
}: SimulationLineChartProps) {
  const hasData = useMemo(
    () => series.some((line) => line.values.length > 1),
    [series]
  );

  const minMax = useMemo(() => {
    const allValues = series.flatMap((line) => line.values);
    if (allValues.length === 0) {
      return { min: 0, max: 1 };
    }
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    if (min === max) {
      return { min: min - 1, max: max + 1 };
    }
    return { min, max };
  }, [series]);

  return (
    <div className="w-full">
      {!hasData ? (
        <div className="h-44 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm flex items-center justify-center">
          Waiting for enough datapoints...
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <svg viewBox={`0 0 1000 ${height}`} className="w-full h-auto">
            {series.map((line) => {
              const path = buildPath(line.values, 1000, height, minMax.min, minMax.max);
              return (
                <path
                  key={line.name}
                  d={path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>

          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Min: {valueFormatter(minMax.min)}</span>
            <span>Max: {valueFormatter(minMax.max)}</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {series.map((line) => (
          <div key={line.name} className="flex items-center gap-1.5 text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span>{line.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
