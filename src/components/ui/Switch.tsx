import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import { splitProps } from "solid-js";

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export function Switch(props: SwitchProps) {
  const [local] = splitProps(props, [
    "checked",
    "onChange",
    "disabled",
    "label",
    "description",
  ]);

  return (
    <KobalteSwitch
      class="flex items-center justify-between"
      checked={local.checked}
      onChange={local.onChange}
      disabled={local.disabled}
    >
      <div class="flex flex-col">
        {local.label && (
          <KobalteSwitch.Label class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {local.label}
          </KobalteSwitch.Label>
        )}
        {local.description && (
          <KobalteSwitch.Description class="text-sm text-gray-500 dark:text-gray-400">
            {local.description}
          </KobalteSwitch.Description>
        )}
      </div>
      <KobalteSwitch.Input class="sr-only" />
      <KobalteSwitch.Control class="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative transition-colors ui-checked:bg-green-500 dark:ui-checked:bg-green-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        <KobalteSwitch.Thumb class="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform translate-x-0.5 ui-checked:translate-x-[22px] mt-0.5" />
      </KobalteSwitch.Control>
    </KobalteSwitch>
  );
}
