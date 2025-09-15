"use client";

import { CartesianGrid, XAxis, Bar, BarChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";

const Chart2 = () => {
  const chartData = [
    { departemen: "HR", "Material Request": 186 },
    { departemen: "GA", "Material Request": 305 },
    { departemen: "IT", "Material Request": 237 },
    { departemen: "Service", "Material Request": 73 },
    { departemen: "Warehouse", "Material Request": 209 },
    { departemen: "Manufaktur", "Material Request": 214 },
    { departemen: "Finance", "Material Request": 214 },
    { departemen: "Marketing", "Material Request": 214 },
    { departemen: "Purchasing", "Material Request": 214 },
    { departemen: "K3", "Material Request": 214 },
  ].sort();

  const chartConfig = {
    "Material Request": {
      label: "Material Request",
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={chartConfig}>
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="departemen"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent className="w-40" />}
        />
        <Bar dataKey="Material Request" fill="var(--chart-3)" radius={8} />
      </BarChart>
    </ChartContainer>
  );
};
export default Chart2;
