/**
 * Static illustration of a small three-generation family tree, used on the
 * landing page hero. It mirrors how the real graph looks (solid parent-child
 * links, dashed spouse links, highlighted "You" node) and shows the product's
 * core promise: the relationship to a distant relative is worked out for you.
 *
 * Purely decorative SVG — the meaning is conveyed by the surrounding copy, so
 * it is hidden from assistive technology.
 */

interface IllustrationNode {
  x: number;
  y: number;
  initials: string;
  name: string;
  variant?: 'you' | 'target';
}

const NODE_RADIUS = 22;

const NODES: IllustrationNode[] = [
  // Generation 1 — grandparents
  { x: 150, y: 44, initials: 'RS', name: 'Grandpa Raj' },
  { x: 290, y: 44, initials: 'KS', name: 'Grandma Kamla' },
  // Generation 2 — parents, aunt and their spouses
  { x: 50, y: 154, initials: 'MS', name: 'Mom' },
  { x: 150, y: 154, initials: 'AS', name: 'Dad' },
  { x: 290, y: 154, initials: 'MV', name: 'Aunt Meena' },
  { x: 390, y: 154, initials: 'VV', name: 'Uncle Vikram' },
  // Generation 3 — you and your cousin
  { x: 100, y: 264, initials: 'You', name: 'You', variant: 'you' },
  { x: 340, y: 264, initials: 'PV', name: 'Priya', variant: 'target' },
];

/** Parent-child links drawn as elbow connectors from a couple's midpoint. */
const PARENT_CHILD_PATHS = [
  // Grandparents → Dad and Aunt Meena
  'M220 44 V100 H150 V132',
  'M220 100 H290 V132',
  // Mom + Dad → You
  'M100 154 V242',
  // Aunt Meena + Uncle Vikram → Priya
  'M340 154 V242',
];

/** Spouse links (dashed), between the edges of the two circles. */
const SPOUSE_LINES: Array<[number, number, number]> = [
  // [x1, x2, y]
  [150 + NODE_RADIUS, 290 - NODE_RADIUS, 44],
  [50 + NODE_RADIUS, 150 - NODE_RADIUS, 154],
  [290 + NODE_RADIUS, 390 - NODE_RADIUS, 154],
];

function nodeClasses(variant: IllustrationNode['variant']) {
  switch (variant) {
    case 'you':
      return { circle: 'fill-brand-500 stroke-brand-200', text: 'fill-white' };
    case 'target':
      return { circle: 'fill-sun-100 stroke-sun-400', text: 'fill-amber-800' };
    default:
      return { circle: 'fill-white stroke-stone-200', text: 'fill-stone-600' };
  }
}

export default function TreeIllustration({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative rounded-[2.5rem] border-2 border-stone-100 bg-white p-4 shadow-[0_8px_0_0_rgb(231_229_228)] sm:p-6">
        <svg
          viewBox="0 0 440 320"
          className="h-auto w-full"
          aria-hidden="true"
          focusable="false"
        >
          {/* Highlighted connection: You → Dad → grandparents → Aunt → Priya */}
          <path
            d="M100 242 V154 H150 V100 H290 V154 H340 V242"
            className="fill-none stroke-sun-300"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {PARENT_CHILD_PATHS.map((d) => (
            <path
              key={d}
              d={d}
              className="fill-none stroke-[#c4a484]"
              strokeWidth={2.5}
            />
          ))}

          {SPOUSE_LINES.map(([x1, x2, y]) => (
            <line
              key={`${x1}-${y}`}
              x1={x1}
              x2={x2}
              y1={y}
              y2={y}
              className="stroke-brand-400"
              strokeWidth={2.5}
              strokeDasharray="5 4"
            />
          ))}

          {NODES.map((node) => {
            const classes = nodeClasses(node.variant);
            return (
              <g key={node.name}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS}
                  className={classes.circle}
                  strokeWidth={node.variant ? 4 : 2.5}
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className={`${classes.text} text-[11px] font-extrabold`}
                >
                  {node.initials}
                </text>
                <text
                  x={node.x}
                  y={node.y + NODE_RADIUS + 15}
                  textAnchor="middle"
                  className="fill-stone-500 text-[10px] font-bold"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Relationship callout, like the graph's side panel */}
        <div className="absolute -bottom-10 right-4 flex items-center gap-3 rounded-3xl border-2 border-sun-300 bg-white px-4 py-3 shadow-[0_4px_0_0_var(--color-sun-300)] animate-float sm:right-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun-100 text-xs font-extrabold text-amber-800">
            PV
          </span>
          <div className="text-left">
            <p className="text-sm font-extrabold text-stone-900">Priya 👋</p>
            <p className="text-xs font-bold text-brand-600">Your first cousin!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
