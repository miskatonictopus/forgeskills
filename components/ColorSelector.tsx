// components/ColorSelector.tsx

type Props = {
    colorActual: string
    onSelect: (color: string) => void
  }
  
  export function ColorSelector({ colorActual, onSelect }: Props) {
    const colores = [
      "#262626", // Neutral-800
      "#292524", // Stone-800
      "#1e293b", // Slate-800
      "#991b1b", // Red-800
      "#9a3412", // Orange-800
      "#854d0e", // Yellow-800
      "#065f46", // Emerald-800
      "#115e59", // Teal-800
      "#155e75", // Cyan-800
      "#5b21b6", // Violet-800
      "#86198f", // fucksia-800
      "#9d174d", // Pink-800
      "#9f1239", // Rose-800
    ]
  
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {colores.map((color) => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            className={`w-6 h-6 rounded-full border-2 transition-all duration-150 ${
              color === colorActual ? "border-white ring-2 ring-white" : "border-zinc-300"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Seleccionar color ${color}`}
          />
        ))}
      </div>
    )
  }
  