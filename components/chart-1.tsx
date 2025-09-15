"use client";

import { CartesianGrid, XAxis, Area, AreaChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";

const Chart = () => {
  const chartData = [
    { bulan: "Januari", "Material Request": 186, "Purchase Order": 80 },
    { bulan: "Februari", "Material Request": 305, "Purchase Order": 200 },
    { bulan: "Maret", "Material Request": 237, "Purchase Order": 120 },
    { bulan: "April", "Material Request": 73, "Purchase Order": 190 },
    { bulan: "Mei", "Material Request": 209, "Purchase Order": 130 },
    { bulan: "Juni", "Material Request": 214, "Purchase Order": 140 },
    { bulan: "Juli", "Material Request": 214, "Purchase Order": 140 },
  ];

  const chartConfig = {
    desktop: {
      label: "Material Request",
      color: "var(--chart-1)",
    },
    mobile: {
      label: "Purchase Order",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig}>
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bulan"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent className="w-40" />}
        />
        <defs>
          <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-desktop)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-desktop)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-mobile)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-mobile)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <Area
          dataKey="Material Request"
          type="natural"
          fill="url(#fillMobile)"
          fillOpacity={0.4}
          stroke="var(--color-mobile)"
          stackId="a"
        />
        <Area
          dataKey="Purchase Order"
          type="natural"
          fill="url(#fillDesktop)"
          fillOpacity={0.4}
          stroke="var(--color-desktop)"
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  );
};

export default Chart;
