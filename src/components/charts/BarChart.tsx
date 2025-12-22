import type { EChartsOption } from "echarts";
import { createMemo } from "solid-js";
import { EChartsWrapper } from "./EChartsWrapper";

export interface BarChartData {
	name: string;
	value: number;
	secondaryValue?: number;
}

interface BarChartProps {
	data: BarChartData[];
	title?: string;
	valueLabel?: string;
	secondaryLabel?: string;
	onClick?: (name: string) => void;
	class?: string;
	horizontal?: boolean;
}

export function BarChart(props: BarChartProps) {
	const option = createMemo((): EChartsOption => {
		const isHorizontal = props.horizontal !== false;
		const sortedData = [...props.data]
			.sort((a, b) => b.value - a.value)
			.slice(0, 7);

		return {
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
			},
			grid: {
				left: isHorizontal ? 120 : 40,
				right: 20,
				top: 20,
				bottom: 20,
				containLabel: false,
			},
			xAxis: isHorizontal
				? {
						type: "value",
						axisLine: { show: false },
						axisTick: { show: false },
						splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
					}
				: {
						type: "category",
						data: sortedData.map((d) => d.name),
						axisLine: { show: false },
						axisTick: { show: false },
					},
			yAxis: isHorizontal
				? {
						type: "category",
						data: sortedData.map((d) => d.name).reverse(),
						axisLine: { show: false },
						axisTick: { show: false },
						axisLabel: {
							width: 100,
							overflow: "truncate",
							ellipsis: "...",
						},
					}
				: {
						type: "value",
						axisLine: { show: false },
						axisTick: { show: false },
						splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
					},
			series: [
				{
					type: "bar",
					data: isHorizontal
						? [...sortedData].reverse().map((d) => d.value)
						: sortedData.map((d) => d.value),
					barWidth: "60%",
					itemStyle: {
						borderRadius: [4, 4, 4, 4],
						color: {
							type: "linear",
							x: isHorizontal ? 0 : 0,
							y: isHorizontal ? 0 : 1,
							x2: isHorizontal ? 1 : 0,
							y2: 0,
							colorStops: [
								{ offset: 0, color: "#3b82f6" },
								{ offset: 1, color: "#8b5cf6" },
							],
						},
					},
					emphasis: {
						itemStyle: {
							color: {
								type: "linear",
								x: isHorizontal ? 0 : 0,
								y: isHorizontal ? 0 : 1,
								x2: isHorizontal ? 1 : 0,
								y2: 0,
								colorStops: [
									{ offset: 0, color: "#60a5fa" },
									{ offset: 1, color: "#a78bfa" },
								],
							},
						},
					},
					animationDuration: 800,
					animationEasing: "elasticOut",
				},
			],
		};
	});

	const handleClick = (params: unknown) => {
		const p = params as { name?: string };
		if (props.onClick && p.name) {
			props.onClick(p.name);
		}
	};

	return (
		<EChartsWrapper
			option={option()}
			class={props.class}
			onChartClick={handleClick}
		/>
	);
}
