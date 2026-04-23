import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Type, ListChecks, AlignLeft, Image as ImageIcon, QrCode,
  Sparkles, Users, Plus, X, GripVertical, ChevronDown, MoreVertical, FolderOpen,
} from 'lucide-react';
import { AnswerType, MCLabelStyle } from '@/components/poll-create/ContentPanel';
import { AssetId, AssetMeta } from './types';
import { BlockLetter, BLOCK_LETTERS, DEFAULT_BLOCK_LABELS } from '@/lib/poll-persistence';

export const ASSET_REGISTRY: Record<AssetId, AssetMeta> = {
  question:    { id: 'question',    label: 'Question Text', icon: Type,        description: 'Main on-air question shown above answers',   required: true },
  answers:     { id: 'answers',     label: 'Answer Bars',   icon: ListChecks,  description: 'Voter response options and labels',           required: true },
  subheadline: { id: 'subheadline', label: 'Subheadline',   icon: AlignLeft,   description: 'Optional secondary line beneath the question' },
  background:  { id: 'background',  label: 'Background',    icon: ImageIcon,   description: 'Solid color or uploaded image backdrop' },
  qr:          { id: 'qr',          label: 'QR Code',       icon: QrCode,      description: 'Scannable code linking viewers to the vote URL' },
  logo:        { id: 'logo',        label: 'Logo',          icon: Sparkles,    description: 'Show or network branding overlay' },
  voterTally:  { id: 'voterTally',  label: 'Voter Tally',   icon: Users,       description: 'Live count of received votes' },
};

export const SEEDED_ASSETS: AssetId[] = ['question', 'answers'];

interface PollingAssetsPaneProps {
  folders: { id: string; name: string; blockLetter: BlockLetter; collapsed?: boolean; assetIds: AssetId[] }[];
  activeFolderId: string;
  enabledAssets: AssetId[];
  onEnabledAssetsChange: (next: AssetId[]) => void;
  selectedAssetId: AssetId | null;
  onSelectAsset: (id: AssetId | null) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onAddAssetToFolder: (folderId: string, assetId: AssetId) => void;
  onRenameFolder: (folderId: string, nextName: string) => void;
  onSetFolderBlock: (folderId: string, next: BlockLetter) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolderCollapse: (folderId: string) => void;
  blockLetter: BlockLetter;
  onBlockLetterChange: (next: BlockLetter) => void;

  // Underlying poll state (passed in)
  question: string; setQuestion: (v: string) => void;
  subheadline: string; setSubheadline: (v: string) => void;
  internalName: string; setInternalName: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  answerType: AnswerType; setAnswerType: (v: AnswerType) => void;
  mcLabelStyle: MCLabelStyle; setMcLabelStyle: (v: MCLabelStyle) => void;
  answers: { id: string; text: string; shortLabel: string; testVotes?: number }[];
  setAnswers: (v: { id: string; text: string; shortLabel: string; testVotes?: number }[]) => void;
  onAddAnswer: () => void;
}

export function PollingAssetsPane({
  folders,
  activeFolderId,
  enabledAssets, onEnabledAssetsChange,
  selectedAssetId, onSelectAsset,
  onSelectFolder,
  onCreateFolder,
  onAddAssetToFolder,
  onRenameFolder,
  onSetFolderBlock,
  onDeleteFolder,
  onToggleFolderCollapse,
  blockLetter, onBlockLetterChange,
  question, setQuestion,
  subheadline, setSubheadline,
  internalName, setInternalName,
  slug, setSlug,
  answerType, setAnswerType,
  mcLabelStyle, setMcLabelStyle,
  answers, setAnswers,
  onAddAnswer,
}: PollingAssetsPaneProps) {
  const [draggedId, setDraggedId] = useState<AssetId | null>(null);

  const reorder = (fromId: AssetId, toId: AssetId) => {
    if (fromId === toId) return;
    const next = [...enabledAssets];
    const fromIdx = next.indexOf(fromId);
    const toIdx = next.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, fromId);
    onEnabledAssetsChange(next);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between bg-background/40">
        <div>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {enabledAssets.length} asset{enabledAssets.length === 1 ? '' : 's'}
          </span>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            Assets live inside block folders.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {folders.map((folder) => {
          const folderAssets = folder.assetIds;
          const folderAvailableAssets = (Object.keys(ASSET_REGISTRY) as AssetId[])
            .filter((assetId) => !folderAssets.includes(assetId));
          const isActiveFolder = folder.id === activeFolderId;
          const isCollapsed = Boolean(folder.collapsed);

          return (
            <div key={folder.id} className={`rounded-lg border overflow-hidden transition-colors ${isActiveFolder ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/40'}`}>
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/40 bg-background/30">
              <button type="button" onClick={() => onSelectFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActiveFolder ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate">{folder.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{DEFAULT_BLOCK_LABELS[folder.blockLetter]}</p>
                </div>
              </button>

              {isActiveFolder && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[10px]">
                      Block {blockLetter}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[10px] uppercase font-mono">
                      Assign Folder Block
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {BLOCK_LETTERS.map((letter) => (
                      <DropdownMenuItem key={letter} onClick={() => onBlockLetterChange(letter)} className="gap-2 justify-between">
                        <span className="flex items-center gap-2">
                          <span className={`font-mono text-[11px] ${blockLetter === letter ? 'text-primary' : 'text-muted-foreground'}`}>{letter}</span>
                          <span className="text-xs">{DEFAULT_BLOCK_LABELS[letter]}</span>
                        </span>
                        {blockLetter === letter && <span className="text-[9px] text-primary">●</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onSelectFolder(folder.id)}
                    aria-label={`Open add asset menu for ${folder.name}`}
                    title={`Add asset to ${folder.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" aria-label={`Add asset options for ${folder.name}`}>
                  <DropdownMenuLabel className="text-[10px] uppercase font-mono">
                    Add Asset To Folder
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {folderAvailableAssets.length === 0 && (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground italic">
                      All assets added.
                    </div>
                  )}
                  {folderAvailableAssets.map((id) => {
                    const meta = ASSET_REGISTRY[id];
                    const Icon = meta.icon;
                    return (
                      <DropdownMenuItem key={id} onClick={() => { onSelectFolder(folder.id); onAddAssetToFolder(folder.id, id); }} className="gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-xs">{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">{meta.description}</span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onSelectFolder(folder.id)}
                    aria-label={`Open folder actions for ${folder.name}`}
                    title={`Folder actions for ${folder.name}`}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44" aria-label={`Folder actions for ${folder.name}`}>
                  <DropdownMenuItem
                    aria-label={`Rename folder ${folder.name}`}
                    onClick={() => {
                      const nextName = window.prompt('Rename folder', folder.name);
                      if (nextName) onRenameFolder(folder.id, nextName);
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuLabel className="text-[10px] uppercase font-mono">Set Block</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={folder.blockLetter}>
                    {BLOCK_LETTERS.map((letter) => (
                      <DropdownMenuRadioItem
                        key={`${folder.id}-${letter}`}
                        value={letter}
                        aria-label={`Set ${folder.name} to Block ${letter}`}
                        onSelect={() => onSetFolderBlock(folder.id, letter)}
                        className="justify-between"
                      >
                        <span>{letter}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={folders.length <= 1}
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={() => onDeleteFolder(folder.id)}
                  >
                    Delete Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  onSelectFolder(folder.id);
                  onToggleFolderCollapse(folder.id);
                }}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} folder ${folder.name}`}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </Button>
            </div>

            {!isCollapsed && (
              <div className="p-2.5 space-y-2">
                {folderAssets.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">This folder is seeded—add extra assets with + if needed.</p>
                  </div>
                )}
                {folderAssets.map((id) => (
                  <AssetCard
                    key={id}
                    meta={ASSET_REGISTRY[id]}
                    isSelected={selectedAssetId === id}
                    onSelect={() => { onSelectFolder(folder.id); onSelectAsset(id); }}
                    onRemove={() => { onSelectFolder(folder.id); onEnabledAssetsChange(folderAssets.filter((assetId) => assetId !== id)); if (selectedAssetId === id) onSelectAsset(null); }}
                    onDragStart={() => setDraggedId(id)}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={() => { onSelectFolder(folder.id); if (draggedId) reorder(draggedId, id); setDraggedId(null); }}
                  >
                    <AssetEditor
                      assetId={id}
                      question={question} setQuestion={setQuestion}
                      subheadline={subheadline} setSubheadline={setSubheadline}
                      internalName={internalName} setInternalName={setInternalName}
                      slug={slug} setSlug={setSlug}
                      answerType={answerType} setAnswerType={setAnswerType}
                      mcLabelStyle={mcLabelStyle} setMcLabelStyle={setMcLabelStyle}
                      answers={answers} setAnswers={setAnswers}
                      onAddAnswer={onAddAnswer}
                    />
                  </AssetCard>
                ))}
              </div>
            )}
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" className="w-full h-8 text-[10px] gap-1" onClick={onCreateFolder}>
          <Plus className="w-3.5 h-3.5" /> New Folder
        </Button>
      </div>
    </div>
  );
}

/* ---------- Asset Card chrome ---------- */

function AssetCard({
  meta, isSelected, onSelect, onRemove,
  onDragStart, onDragOver, onDrop, children,
}: {
  meta: AssetMeta;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = meta.icon;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={`group rounded-lg border transition-all overflow-hidden cursor-pointer ${
        isSelected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/60 bg-card/40 hover:border-border'
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 bg-background/30">
        <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0 cursor-grab" />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-[11px] font-medium flex-1 truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {meta.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
          className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {!meta.required && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5 opacity-0 group-hover:opacity-100"
            title="Remove asset"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {meta.required && (
          <span className="text-[8px] font-mono uppercase text-muted-foreground/40 px-1">
            REQ
          </span>
        )}
      </div>
      {!collapsed && (
        <div className="p-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------- Per-asset compact editors (full editing happens in Inspector) ---------- */

function AssetEditor(props: {
  assetId: AssetId;
  question: string; setQuestion: (v: string) => void;
  subheadline: string; setSubheadline: (v: string) => void;
  internalName: string; setInternalName: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  answerType: AnswerType; setAnswerType: (v: AnswerType) => void;
  mcLabelStyle: MCLabelStyle; setMcLabelStyle: (v: MCLabelStyle) => void;
  answers: { id: string; text: string; shortLabel: string; testVotes?: number }[];
  setAnswers: (v: { id: string; text: string; shortLabel: string; testVotes?: number }[]) => void;
  onAddAnswer: () => void;
}) {
  const { assetId } = props;

  if (assetId === 'question') {
    return (
      <div className="space-y-1">
        <Input
          value={props.question}
          onChange={(e) => props.setQuestion(e.target.value)}
          placeholder="On-air question…"
          className="bg-background/50 h-8 text-xs"
        />
        <span className="text-[9px] text-muted-foreground font-mono">
          {props.question.length}/80
        </span>
      </div>
    );
  }

  if (assetId === 'subheadline') {
    return (
      <Input
        value={props.subheadline}
        onChange={(e) => props.setSubheadline(e.target.value)}
        placeholder="Optional subtitle"
        className="bg-background/50 h-8 text-xs"
      />
    );
  }

  if (assetId === 'answers') {
    return (
      <div className="space-y-1.5">
        {props.answers.map((a, i) => (
          <Input
            key={a.id}
            value={a.text}
            onChange={(e) => {
              const next = [...props.answers];
              next[i] = { ...next[i], text: e.target.value };
              props.setAnswers(next);
            }}
            placeholder={`Answer ${i + 1}`}
            className="bg-background/50 h-7 text-[11px]"
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1 text-[10px]"
          onClick={props.onAddAnswer}
          disabled={props.answerType === 'yes-no' || props.answers.length >= 4}
        >
          <Plus className="w-3 h-3" /> Add Answer Bar
        </Button>
        <p className="text-[9px] text-muted-foreground">
          Open Inspector for label style and test vote counts.
        </p>
      </div>
    );
  }

  // QR / Logo / Voter Tally / Background — quick summaries; details in Inspector
  return (
    <p className="text-[10px] text-muted-foreground italic">
      Configure in Inspector pane →
    </p>
  );
}

/* ---------- Helper: tiny export to avoid unused imports lint ---------- */
export const _MoreVertical = MoreVertical;
