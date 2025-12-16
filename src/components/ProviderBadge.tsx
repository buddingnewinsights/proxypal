import type { Component } from "solid-js";

interface ProviderBadgeProps {
	source: string;
	size?: "sm" | "md";
}

export const ProviderBadge: Component<ProviderBadgeProps> = (props) => {
	const size = () => props.size ?? "sm";

	const getBadgeConfig = () => {
		switch (props.source) {
			case "vertex":
				return {
					label: "Vertex",
					bgColor: "bg-blue-100 dark:bg-blue-900/30",
					textColor: "text-blue-700 dark:text-blue-300",
					icon: "📄",
				};
			case "vertex+gemini-api":
				return {
					label: "Vertex+API",
					bgColor: "bg-purple-100 dark:bg-purple-900/30",
					textColor: "text-purple-700 dark:text-purple-300",
					icon: "📄🔑",
				};
			case "gemini-api":
				return {
					label: "API Key",
					bgColor: "bg-green-100 dark:bg-green-900/30",
					textColor: "text-green-700 dark:text-green-300",
					icon: "🔑",
				};
			case "copilot":
				return {
					label: "Copilot",
					bgColor: "bg-orange-100 dark:bg-orange-900/30",
					textColor: "text-orange-700 dark:text-orange-300",
					icon: "🤖",
				};
			case "oauth":
				return {
					label: "OAuth",
					bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
					textColor: "text-indigo-700 dark:text-indigo-300",
					icon: "🔐",
				};
			case "api-key":
				return {
					label: "API Key",
					bgColor: "bg-green-100 dark:bg-green-900/30",
					textColor: "text-green-700 dark:text-green-300",
					icon: "🔑",
				};
			default:
				return {
					label: props.source || "Unknown",
					bgColor: "bg-gray-100 dark:bg-gray-800",
					textColor: "text-gray-600 dark:text-gray-400",
					icon: "📦",
				};
		}
	};

	const config = () => getBadgeConfig();
	const sizeClasses = () =>
		size() === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

	return (
		<span
			class={`inline-flex items-center gap-1 rounded-full font-medium ${config().bgColor} ${config().textColor} ${sizeClasses()}`}
		>
			<span class="text-[10px]">{config().icon}</span>
			{config().label}
		</span>
	);
};

export default ProviderBadge;
