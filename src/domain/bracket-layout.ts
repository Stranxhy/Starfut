import { parseSource, type BracketFormat } from "./bracket";

const CARD_WIDTH = 240;
const CARD_HEIGHT = 140;
const COLUMN_GAP = 48;
const HEADER_HEIGHT = 48;

/** Coordenadas solo de presentación; los cruces siempre provienen del formato de la liga. */
export function layoutBracket(format: BracketFormat) {
  const bodyHeight = Math.max(1, ...format.stages.map((stage) => stage.ties.length)) * 164;
  const nodes = format.stages.flatMap((stage, column) => stage.ties.map((tie, index) => ({
    ...tie, stage: stage.code, column, slot: index + 1,
    x: column * (CARD_WIDTH + COLUMN_GAP),
    y: HEADER_HEIGHT + ((index + 0.5) * bodyHeight / stage.ties.length) - CARD_HEIGHT / 2,
    width: CARD_WIDTH, height: CARD_HEIGHT,
  })));
  const edges = nodes.flatMap((node) => (["home", "away"] as const).flatMap((side) => {
    const source = parseSource(node[side]);
    if (!source || source.kind === "seed") return [];
    const origin = nodes.find((n) => n.stage === source.stage && n.slot === source.tie && n.column < node.column);
    if (!origin) return [];
    const x1 = origin.x + origin.width;
    const y1 = origin.y + origin.height / 2;
    const x2 = node.x;
    const y2 = node.y + (side === "home" ? 58 : 108);
    return [{
      from: `${origin.stage}:${origin.slot}`, to: `${node.stage}:${node.slot}`, side, kind: source.kind,
      path: `M ${x1} ${y1} C ${x1 + COLUMN_GAP / 2} ${y1}, ${x2 - COLUMN_GAP / 2} ${y2}, ${x2} ${y2}`,
    }];
  }));
  return {
    nodes, edges, cardWidth: CARD_WIDTH, columnGap: COLUMN_GAP,
    width: Math.max(CARD_WIDTH, format.stages.length * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP),
    height: HEADER_HEIGHT + bodyHeight,
  };
}
