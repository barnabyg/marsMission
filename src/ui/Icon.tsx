import { createElement } from "react";
import { icons, type IconName } from "./icons";

export type { IconName } from "./icons";

interface IconProps {
  name: IconName;
  /** What the icon means, for a screen reader. Leave it out when text beside the icon already says it. */
  label?: string;
  className?: string;
}

/** A line icon from the game's icon set, sized to the text around it and drawn in its colour. */
export function Icon({ name, label, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true, focusable: false })}
    >
      {icons[name].map(([tag, attributes], index) =>
        // An icon's shapes never change order, so their places are stable keys.
        createElement(tag, { key: index, ...attributes }),
      )}
    </svg>
  );
}
