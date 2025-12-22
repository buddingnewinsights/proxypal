import type { EChartsOption } from "echarts";
import { createMemo } from "solid-js";
import { EChartsWrapper } from "./EChartsWrapper";

export interface DonutChartData {
	name: string;
	value: number;
	color?: string;
}

interface DonutChartProps {
	data: DonutChartData[];
	title?: string;
	centerText?: string;
	centerSubtext?: string;
	onClick?: (name: string) => void;
	class?: string;
}

const COLORS = [
	"#3b82f6", // blue
	"#8b5cf6", // purple
	"#06b6d4", // cyan
	"#10b981", // green
	"#f59e0b", // amber
	"#ef4444", // red
	"#ec4899", // pink
	"#6366f1", // indigo
];

export function DonutChart(props: DonutChartProps) {
	const option = createMemo(
		(): EChartsOption => ({
			tooltip: {
				trigger: "item",
				formatter: "{b}: {c} ({d}%)",
			},
			legend: {
				orient: "vertical",
				right: 10,
				top: "center",
				itemGap: 12,
				textStyle: { fontSize: 12 },
			},
			series: [
				{
					type: "pie",
					radius: ["50%", "75%"],
					center: ["35%", "50%"],
					avoidLabelOverlap: true,
					itemStyle: {
						borderRadius: 6,
						borderColor: "transparent",
						borderWidth: 2,
					},
					label: { show: false },
					emphasis: {
						label: {
							show: true,
							fontSize: 14,
							fontWeight: "bold",
						},
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: "rgba(0, 0, 0, 0.3)",
						},
					},
					labelLine: { show: false },
					data: props.data.map((item, index) => ({
						name: item.name,
						value: item.value,
						itemStyle: {
							color: item.color || COLORS[index % COLORS.length],
						},
					})),
					animationType: "scale",
					animationEasing: "elasticOut",
					animationDuration: 800,
				},
			],
		}),
	);

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
