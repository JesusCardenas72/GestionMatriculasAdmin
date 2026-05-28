import { type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from "react-resizable-panels";
import { Columns2 } from "lucide-react";

const LEFT_ID = "left";
const RIGHT_ID = "right";

interface Props {
  id: string;
  defaultLeftSize: string;
  minLeftSize?: string;
  maxLeftSize?: string;
  left: ReactNode;
  right: ReactNode;
  className?: string;
}

export default function ResizableColumns({
  id,
  defaultLeftSize,
  minLeftSize = "200px",
  maxLeftSize = "600px",
  left,
  right,
  className = "",
}: Props) {
  const storageKey = `panel-${id}`;
  const leftPanelRef = usePanelRef();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: storageKey,
    storage: localStorage,
  });

  function handleReset() {
    leftPanelRef.current?.resize(defaultLeftSize);
  }

  return (
    <div className={`relative ${className}`}>
      <Group
        orientation="horizontal"
        id={storageKey}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id={LEFT_ID}
          defaultSize={defaultLeftSize}
          minSize={minLeftSize}
          maxSize={maxLeftSize}
          panelRef={leftPanelRef}
        >
          {left}
        </Panel>
        <Separator className="group relative w-3 mx-0.5 flex items-center justify-center cursor-col-resize">
          <div className="flex flex-row gap-0.5">
            <div className="w-0.5 h-4 rounded-full bg-[var(--tc-border)] opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-0.5 h-4 rounded-full bg-[var(--tc-border)] opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </Separator>
        <Panel id={RIGHT_ID}>
          {right}
        </Panel>
      </Group>

      <button
        onClick={handleReset}
        title="Restaurar paneles"
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg transition-all opacity-40 hover:!opacity-100 focus:opacity-100"
        style={{
          color: "var(--tc-ink-mute)",
          background: "var(--tc-card)",
          border: "1px solid var(--tc-border)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--tc-primary)";
          e.currentTarget.style.background = "var(--tc-primary-tint)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--tc-ink-mute)";
          e.currentTarget.style.background = "var(--tc-card)";
        }}
      >
        <Columns2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
