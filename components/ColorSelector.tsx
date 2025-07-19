// components/ColorSelector.tsx

type Props = {
    colorActual: string
    onSelect: (color: string) => void
  }
  
  export function ColorSelector({ colorActual, onSelect }: Props) {
    const colores = [
      "#042f2e", // Teal-950
      "#292524", // Teal-900
      "#164e63", // Teal-800
      "#0f766e", // Teal-700
      "#881337", // Zinc-900
      "#27272a", // Zinc-800
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
  