'use client';

import React, { forwardRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Resource } from '@/lib/types';

interface ResourceLoadChartProps {
  data: any[];
  resources: Resource[]; // List of resources to include in the stack
  width: number;
  height: number;
}

// Predefined palette for resources
const RESOURCE_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#ea580c', // orange-600
  '#65a30d', // lime-600
];

const getResourceColor = (index: number) => {
  return RESOURCE_COLORS[index % RESOURCE_COLORS.length];
};

export const ResourceLoadChart = forwardRef<HTMLDivElement, ResourceLoadChartProps>(
  ({ data, resources, width, height }, ref) => {
    return (
      <div
        ref={ref}
        className="overflow-hidden w-full h-full bg-card border-t"
        style={{ height }}
      >
        <div style={{ width: width, height: '100%' }}>
          <BarChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            barCategoryGap={0} // Try to maximize bar width to fill the "cell"
            barGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" hide />
            <YAxis
                width={40}
                fontSize={10}
                tickFormatter={(value) => `${value}h`}
            />
            <Tooltip
                formatter={(value: number, name: string) => {
                    const res = resources.find(r => r.id === name);
                    return [`${Math.round(value * 10) / 10}h`, res?.name || name];
                }}
                labelStyle={{ color: 'black' }}
            />
            {resources.map((resource, index) => (
              <Bar
                key={resource.id}
                dataKey={resource.id}
                stackId="a"
                fill={getResourceColor(index)}
                name={resource.name}
              />
            ))}
          </BarChart>
        </div>
      </div>
    );
  }
);

ResourceLoadChart.displayName = 'ResourceLoadChart';
