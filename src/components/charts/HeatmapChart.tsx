import type { EChartsOption } from "echarts";
import { createMemo } from "solid-js";
import { themeStore } from "../../stores/theme";
import { EChartsWrapper } from "./EChartsWrapper";

export interface HeatmapData {
	day: number; // 0-6 (Mon-Sun)
	hour: number; // 0-23
	value: number;
}

interface HeatmapChartProps {
	data: HeatmapData[];
	title?: string;
	onClick?: (day: number, hour: number) => void;
	class?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) =>
	i % 3 === 0 ? `${i}:00` : "",
);

export function HeatmapChart(props: HeatmapChartProps) {
	const option = createMemo((): EChartsOption => {
		const maxValue = Math.max(...props.data.map((d) => d.value), 1);
		const isDark = themeStore.resolvedTheme() === "dark";

		return {
			tooltip: {
				position: "top",
			},
			grid: {
				left: 50,
				right: 20,
				top: 20,
				bottom: 40,
			},
			xAxis: {
				type: "category",
				data: HOURS,
				splitArea: { show: true },
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { fontSize: 10 },
			},
			yAxis: {
				type: "category",
				data: DAYS,
				splitArea: { show: true },
				axisLine: { show: false },
				axisTick: { show: false },
			},
			visualMap: {
				min: 0,
				max: maxValue,
				calculable: true,
				orient: "horizontal",
				left: "center",
				bottom: 0,
				show: false,
				inRange: {
					color: isDark
						? ["#1e293b", "#3b82f6", "#8b5cf6"]
						: ["#eff6ff", "#3b82f6", "#7c3aed"],
				},
			},
			series: [
				{
					type: "heatmap",
					data: props.data.map((d) => [d.hour, d.day, d.value]),
					label: { show: false },
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowColor: "rgba(0, 0, 0, 0.5)",
						},
					},
					animationDuration: 1000,
				},
			],
		};
	});

	const handleClick = (params: unknown) => {
		const p = params as { data?: [number, number, number] };
		if (props.onClick && p.data) {
			const [hour, day] = p.data;
			props.onClick(day, hour);
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
