'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Background, Controls, Edge, Handle, Node, NodeProps, Position, ReactFlow, ReactFlowProvider, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { Badge, Bar, Button, cx } from './ui';
import { fmtGrade, gradeTone } from '@/lib/format';

const fill = (m: number | null) => ({ high: '#0e7c6b', mid: '#a16207', low: '#c2410c', none: '#8a97a6' }[gradeTone(m)]);
const soft = (m: number | null) => ({ high: '#e3f2ef', mid: '#fbf0d9', low: '#fdebe1', none: '#eef1f4' }[gradeTone(m)]);
const center = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, pointerEvents: 'none' as const };
const H = { s: <Handle type="source" position={Position.Top} style={center} />, t: <Handle type="target" position={Position.Top} style={center} /> };

function RootNode({ data }: NodeProps) {
  return <div className="rounded-full bg-ink text-white font-display font-semibold text-lg px-6 py-4 text-center shadow-lg">{H.s}{H.t}{data.label as string}</div>;
}
function CategoryNode({ data, selected }: NodeProps) {
  const m = data.mastery as number | null;
  return (
    <div className={cx('rounded-lg px-4 py-2.5 text-center min-w-[170px] max-w-[210px] border-2 bg-white cursor-pointer', selected && 'ring-4 ring-marker/60')} style={{ borderColor: fill(m) }}>
      {H.s}{H.t}
      <p className="font-display font-semibold text-sm leading-tight">{data.label as string}</p>
      <p className="text-xs mt-0.5" style={{ color: fill(m) }}><span className="num font-semibold">{fmtGrade(m)}</span> · {data.level as string}{data.collapsed ? ` · ${data.count} temas ocultos` : ''}</p>
    </div>
  );
}
function TopicNode({ data, selected }: NodeProps) {
  const m = data.mastery as number | null;
  return (
    <div className={cx('rounded-full px-3 py-1.5 text-xs max-w-[180px] text-center cursor-pointer border', selected && 'ring-4 ring-marker/60')} style={{ background: soft(m), borderColor: fill(m) }}>
      {H.s}{H.t}
      <span className="font-medium">{data.label as string}</span> <span className="num font-semibold" style={{ color: fill(m) }}>{fmtGrade(m)}</span>
    </div>
  );
}
const nodeTypes = { root: RootNode, category: CategoryNode, topic: TopicNode };

function Map({ data }: { data: any }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showRelated, setShowRelated] = useState(false);
  const [sel, setSel] = useState<{ type: string; item: any } | null>(null);
  const [filter, setFilter] = useState<'all' | 'gaps'>('all');
  const wrap = useRef<HTMLDivElement>(null);
  const { getNodes, fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [{ id: 'root', type: 'root', position: { x: -90, y: -30 }, data: { label: data.root } }];
    const edges: Edge[] = [];
    const cats = data.categories as any[];
    const R = Math.max(330, cats.length * 52);
    cats.forEach((c, i) => {
      const a = (i / cats.length) * Math.PI * 2 - Math.PI / 2;
      const cx0 = Math.cos(a) * R, cy0 = Math.sin(a) * R;
      const topics = c.topics.filter((t: any) => filter === 'all' || (t.mastery !== null && t.mastery < 4) || t.gaps.length);
      const isCol = collapsed.has(c.id);
      nodes.push({ id: c.id, type: 'category', position: { x: cx0 - 95, y: cy0 - 25 }, data: { label: c.name, mastery: c.mastery, level: c.level, collapsed: isCol, count: topics.length } });
      edges.push({ id: `r-${c.id}`, type: 'straight', source: 'root', target: c.id, style: { stroke: '#14213d', strokeWidth: 2 } });
      if (isCol) return;
      const spread = Math.min(Math.PI / 1.6, 0.42 * Math.max(1, topics.length - 1));
      topics.forEach((t: any, j: number) => {
        const ta = a + (topics.length > 1 ? -spread / 2 + (spread * j) / (topics.length - 1) : 0);
        const r2 = 200 + (j % 2) * 55;
        nodes.push({ id: t.id, type: 'topic', position: { x: cx0 + Math.cos(ta) * r2 - 70, y: cy0 + Math.sin(ta) * r2 - 14 }, data: { label: t.name, mastery: t.mastery } });
        edges.push({ id: `c-${t.id}`, type: 'straight', source: c.id, target: t.id, style: { stroke: fill(t.mastery), strokeWidth: 1.5 } });
      });
    });
    const byName = Object.fromEntries(cats.map((c) => [c.name, c.id]));
    for (const l of data.links) edges.push({ id: `l-${l.from}-${l.to}`, type: 'straight', source: byName[l.from], target: byName[l.to], label: l.label, animated: false, style: { stroke: '#5b6b7f', strokeDasharray: '6 4' }, labelStyle: { fontSize: 11, fill: '#33415c' }, labelBgStyle: { fill: '#f6f8fa' } });
    const present = new Set(nodes.map((n) => n.id));
    if (showRelated) for (const r of data.related) if (present.has(r.from) && present.has(r.to)) edges.push({ id: `x-${r.from}-${r.to}`, source: r.from, target: r.to, style: { stroke: '#f5c542', strokeWidth: 1, opacity: 0.8 } });
    return { nodes, edges };
  }, [data, collapsed, showRelated, filter]);

  const onClick = useCallback((_: unknown, n: Node) => {
    if (n.type === 'category') {
      const c = data.categories.find((x: any) => x.id === n.id);
      setSel({ type: 'category', item: c });
    } else if (n.type === 'topic') {
      setSel({ type: 'topic', item: data.categories.flatMap((c: any) => c.topics).find((t: any) => t.id === n.id) });
    }
  }, [data]);
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const downloadPng = async () => {
    const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el) return;
    const b = getNodesBounds(getNodes());
    const w = 2000, h = 1500;
    const vp = getViewportForBounds(b, w, h, 0.2, 2, 0.08);
    const url = await toPng(el, { backgroundColor: '#ffffff', width: w, height: h, style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` } });
    const a = document.createElement('a'); a.href = url; a.download = `mapa-competencias-${data.student.name.replace(/\s+/g, '_')}.png`; a.click();
  };
  const downloadJson = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'mapa-competencias.json'; a.click();
  };

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-4">
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-line text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showRelated} onChange={(e) => setShowRelated(e.target.checked)} />Relaciones entre temas</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={filter === 'gaps'} onChange={(e) => setFilter(e.target.checked ? 'gaps' : 'all')} />Solo temas por profundizar</label>
          <span className="flex items-center gap-3 ml-auto text-xs text-muted">
            {[['#0e7c6b', '≥ 4,0'], ['#a16207', '3,0–3,9'], ['#c2410c', '< 3,0'], ['#8a97a6', 'sin evidencia']].map(([c, l]) => <span key={l} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
          </span>
          <Button size="sm" variant="secondary" onClick={() => fitView({ duration: 300 })}>Centrar</Button>
          <Button size="sm" variant="secondary" onClick={downloadPng}>Descargar PNG</Button>
          <Button size="sm" variant="ghost" onClick={downloadJson}>JSON</Button>
        </div>
        <div ref={wrap} className="h-[680px]">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onClick} onNodeDoubleClick={(_, n) => n.type === 'category' && toggle(n.id)}
            fitView fitViewOptions={{ padding: 0.1 }} minZoom={0.2} maxZoom={2} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
            <Background gap={24} color="#e6ebf0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <p className="px-4 py-2 text-xs text-muted border-t border-line">Arrastra para moverte, usa la rueda para acercar. Clic en un nodo para ver el detalle; doble clic en una categoría para contraerla o expandirla.</p>
      </div>
      <aside className="bg-card border border-line rounded-lg p-5 h-fit xl:sticky xl:top-6" aria-live="polite">
        {!sel ? <div><p className="font-display font-semibold text-lg">Explora el mapa</p><p className="text-sm text-muted mt-1">Selecciona una categoría o temática para ver los laboratorios donde se aplicó, las evidencias de aprendizaje, el nivel de dominio y lo que falta profundizar.</p></div>
          : sel.type === 'category' ? (
            <div>
              <p className="text-sm text-muted">Categoría</p>
              <p className="font-display font-semibold text-xl">{sel.item.name}</p>
              <div className="my-3"><Bar value={sel.item.mastery} /><p className="text-sm mt-1"><span className="num font-semibold">{fmtGrade(sel.item.mastery)}</span> · {sel.item.level}</p></div>
              <ul className="space-y-1.5 text-sm">{sel.item.topics.map((t: any) => <li key={t.id}><button className="hover:text-teal text-left" onClick={() => setSel({ type: 'topic', item: t })}>{t.name}</button> <span className="num text-muted">{fmtGrade(t.mastery)}</span></li>)}</ul>
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => toggle(sel.item.id)}>{collapsed.has(sel.item.id) ? 'Expandir temas' : 'Contraer temas'}</Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted">{sel.item.category}</p>
              <p className="font-display font-semibold text-xl">{sel.item.name}</p>
              <div className="my-3"><Bar value={sel.item.mastery} /><p className="text-sm mt-1">Dominio: <span className="num font-semibold">{fmtGrade(sel.item.mastery)}</span> · {sel.item.level}</p></div>
              <p className="font-medium text-sm mb-1">Laboratorios donde se aplicó</p>
              <ul className="space-y-3 text-sm">
                {sel.item.labs.map((l: any) => (
                  <li key={l.labId} className="border-l-2 pl-3" style={{ borderColor: fill(l.mastery) }}>
                    <p className="font-medium">{l.title} <span className="text-muted">· Cohorte {l.cohort}</span></p>
                    <p className="text-ink-2">{l.evidence}</p>
                    {l.gaps && <p className="text-low mt-0.5">Profundizar: {l.gaps}</p>}
                    {l.evaluationId && <a className="text-teal text-xs hover:underline" href={`/app/evaluaciones/${l.evaluationId}`}>Ver evaluación</a>}
                  </li>
                ))}
              </ul>
              {!sel.item.gaps.length && sel.item.mastery !== null && sel.item.mastery >= 4 && <Badge tone="high">Sin aspectos pendientes</Badge>}
            </div>
          )}
      </aside>
    </div>
  );
}

export function MindMap({ data }: { data: any }) {
  return <ReactFlowProvider><Map data={data} /></ReactFlowProvider>;
}
