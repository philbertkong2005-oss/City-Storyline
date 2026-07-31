import type {
  LayoutState,
  PanelId,
  PanelVisibility,
} from '../store/useAppStore';

type IconRailProps = {
  panels: PanelVisibility;
  rightColumnOrientation: LayoutState['rightColumnOrientation'];
  orientationDisabled: boolean;
  onToggle: (panelId: PanelId) => void;
  onToggleOrientation: () => void;
  onReset: () => void;
};

type PanelButtonConfig = {
  id: PanelId;
  title: string;
  label: string;
};

const panelButtons: PanelButtonConfig[] = [
  { id: 'header', title: 'Toggle title bar', label: 'Title bar' },
  { id: 'timeline', title: 'Toggle timeline panel', label: 'Timeline' },
  { id: 'chapters', title: 'Toggle chapters panel', label: 'Chapters' },
  { id: 'eventList', title: 'Toggle event list panel', label: 'Event list' },
  { id: 'description', title: 'Toggle description panel', label: 'Description' },
];

function HeaderIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="4" rx="1.25" />
      <path d="M3 12h9" />
      <path d="M3 15.5h6" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h14" />
      <circle cx="10" cy="10" r="2.75" />
    </svg>
  );
}

function ChaptersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h12" />
      <path d="M4 10h9" />
      <path d="M4 15h7" />
    </svg>
  );
}

function EventListIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="0.75" />
      <circle cx="5" cy="10" r="0.75" />
      <circle cx="5" cy="15" r="0.75" />
      <path d="M8 5h8" />
      <path d="M8 10h8" />
      <path d="M8 15h8" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h6l2 2v11H6z" />
      <path d="M12 3.5v3h3" />
      <path d="M8 10h4" />
      <path d="M8 13h5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10a6 6 0 1 0 2-4.47" />
      <path d="M4 4v3.5h3.5" />
    </svg>
  );
}

function StackedColumnsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="13" height="4.5" rx="1" />
      <rect x="3.5" y="11.5" width="13" height="4.5" rx="1" />
    </svg>
  );
}

function SideBySideIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="5.5" height="12" rx="1" />
      <rect x="11" y="4" width="5.5" height="12" rx="1" />
    </svg>
  );
}

function iconForPanel(panelId: PanelId) {
  switch (panelId) {
    case 'header':
      return <HeaderIcon />;
    case 'timeline':
      return <TimelineIcon />;
    case 'chapters':
      return <ChaptersIcon />;
    case 'eventList':
      return <EventListIcon />;
    case 'description':
      return <DescriptionIcon />;
  }
}

export default function IconRail({
  panels,
  rightColumnOrientation,
  orientationDisabled,
  onToggle,
  onToggleOrientation,
  onReset,
}: IconRailProps) {
  const nextOrientation =
    rightColumnOrientation === 'stacked' ? 'columns' : 'stacked';
  const orientationLabel =
    nextOrientation === 'columns'
      ? 'Arrange list and description side by side'
      : 'Stack list and description';

  return (
    <aside className="flex h-full w-[3.25rem] shrink-0 flex-col items-center rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/80 py-3 shadow-panel backdrop-blur">
      <div className="flex flex-1 flex-col items-center gap-2">
        {panelButtons.map((panel) => {
          const active = panels[panel.id];

          return (
            <button
              key={panel.id}
              type="button"
              title={panel.title}
              aria-label={panel.label}
              aria-pressed={active}
              onClick={() => onToggle(panel.id)}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-[1rem] border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
                active
                  ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                  : 'border-slate-300 bg-transparent text-slate-700 hover:border-slate-500 hover:text-slate-950',
              ].join(' ')}
            >
              {iconForPanel(panel.id)}
            </button>
          );
        })}
      </div>

      <div className="mb-3 mt-3 h-px w-8 bg-slate-200" />

      <button
        type="button"
        title={orientationLabel}
        aria-label={orientationLabel}
        disabled={orientationDisabled}
        onClick={onToggleOrientation}
        className={[
          'mb-3 flex h-10 w-10 items-center justify-center rounded-[1rem] border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
          orientationDisabled
            ? 'cursor-not-allowed border-slate-200 bg-white/40 text-slate-300'
            : 'border-slate-300 bg-white/60 text-slate-600 hover:border-slate-500 hover:bg-white hover:text-slate-900',
        ].join(' ')}
      >
        {nextOrientation === 'columns' ? <SideBySideIcon /> : <StackedColumnsIcon />}
      </button>

      <div className="mb-3 h-px w-8 bg-slate-200" />

      <button
        type="button"
        title="Reset layout"
        aria-label="Reset layout"
        onClick={onReset}
        className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-dashed border-slate-300 bg-white/60 text-slate-600 transition hover:border-slate-500 hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <ResetIcon />
      </button>
    </aside>
  );
}
