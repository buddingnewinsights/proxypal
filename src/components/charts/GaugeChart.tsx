import type { EChartsOption } from "echarts";
import { createMemo } from "solid-js";
import { EChartsWrapper } from "./EChartsWrapper";

interface GaugeChartProps {
	value: number; // 0-100
	title?: string;
	class?: string;
}

export function GaugeChart(props: GaugeChartProps) {
	const getColor = (value: number) => {
		if (value >= 95) return "#10b981"; // green
		if (value >= 80) return "#f59e0b"; // amber
		return "#ef4444"; // red
	};

	const option = createMemo(
		(): EChartsOption => ({
			series: [
				{
					type: "gauge",
					startAngle: 180,
					endAngle: 0,
					min: 0,
					max: 100,
					splitNumber: 5,
					radius: "90%",
					center: ["50%", "70%"],
					axisLine: {
						lineStyle: {
							width: 12,
							color: [
								[0.8, "#ef4444"],
								[0.95, "#f59e0b"],
								[1, "#10b981"],
							],
						},
					},
					pointer: {
						icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
						length: "60%",
						width: 8,
						offsetCenter: [0, "-10%"],
						itemStyle: {
							color: getColor(props.value),
						},
					},
					axisTick: {
						length: 6,
						lineStyle: {
							color: "auto",
							width: 1,
						},
					},
					splitLine: {
						length: 10,
						lineStyle: {
							color: "auto",
							width: 2,
						},
					},
					axisLabel: {
						color: "#6b7280",
						fontSize: 10,
						distance: -35,
						formatter: (value: number) => {
							if (value === 0 || value === 100) return `${value}%`;
							return "";
						},
					},
					title: {
						offsetCenter: [0, "20%"],
						fontSize: 12,
						color: "#6b7280",
					},
					detail: {
						fontSize: 28,
						offsetCenter: [0, "-20%"],
						valueAnimation: true,
						formatter: (value: number) => `${value.toFixed(1)}%`,
						color: getColor(props.value),
						fontWeight: "bold",
					},
					data: [
						{
							value: props.value,
							name: props.title || "Success Rate",
						},
					],
					animationDuration: 1000,
					animationEasing: "elasticOut",
				},
			],
		}),
	);

	return <EChartsWrapper option={option()} class={props.class} />;
}
