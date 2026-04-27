import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Type, ListChecks, AlignLeft, Image as ImageIcon, QrCode,
  Sparkles, Users, Plus, X, GripVertical, ChevronDown, MoreVertical, FolderOpen,
  Trash2, Camera, Link2, Copy, MessageCircleQuestion, Layers, Pencil, Check, EyeOff,
} from 'lucide-react';
import { AnswerType, MCLabelStyle } from '@/components/poll-create/ContentPanel';
import { AssetId, AssetMeta } from './types';
import { BlockLetter, BLOCK_LETTERS, DEFAULT_BLOCK_LABELS } from '@/lib/poll-persistence';
import { SCENE_PRESETS, type ScenePreset, type PollScene, getScenePreset } from '@/lib/poll-scenes';

export const ASSET_REGISTRY: Record<AssetId, AssetMeta> = {
  question:    { id: 'question',    label: 'Text',          icon: Type,        description: 'On-air text — question, prompt, lower-third, etc.' },
  answers:     { id: 'answers',     label: 'Answer Bars',   icon: ListChecks,  description: 'Voter response options and labels' },
  answerType:  { id: 'answerType',  label: 'Answer Type',   icon: MessageCircleQuestion, description: 'How viewers vote on their device — Yes/No or multiple choice buttons' },
  subheadline: { id: 'subheadline', label: 'Subheadline',   icon: AlignLeft,   description: 'Optional secondary line beneath the question' },
  background:  { id: 'background',  label: 'Background',    icon: ImageIcon,   description: 'Solid color or uploaded image backdrop' },
  qr:          { id: 'qr',          label: 'QR Code',       icon: QrCode,      description: 'Scannable code linking viewers to the vote URL' },
  logo:        { id: 'logo',        label: 'Logo',          icon: Sparkles,    description: 'Show or network branding overlay' },
  voterTally:  { id: 'voterTally',  label: 'Voter Tally',   icon: Users,       description: 'Live count of received votes' },
  image:       { id: 'image',       label: 'Image',         icon: Camera,      description: 'Custom photo (player headshot, sponsor mark, etc.)' },
};

export const SEEDED_ASSETS: AssetId[] = [];

interface PollingAssetsPaneProps {
  folders: { id: string; name: string; blockLetter: BlockLetter; collapsed?: boolean; assetIds: AssetId[]; inactiveAssetIds?: AssetId[]; linkedFolderId?: string }[];
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
  /** Clone the folder (assets, slug, tally, background) and select it. */
  onDuplicateFolder?: (folderId: string) => void;
  /** Mutually link two folders so they share slate / background / slug. */
  onLinkFolders?: (folderAId: string, folderBId: string) => void;
  /** Break the link on a folder (and its partner). */
  onUnlinkFolder?: (folderId: string) => void;
  /** Toggle an asset's inactive flag. Used by the "Reactivate" button on
   *  the dimmed QR card after a Convert-to-Bars action. */
  onToggleAssetInactive?: (folderId: string, assetId: AssetId, inactive: boolean) => void;
  blockLetter: BlockLetter;
  onBlockLetterChange: (next: BlockLetter) => void;
  /**
   * When true, the assets pane is greyed out and asset add/edit controls
   * are blocked. Set when the active folder/poll has zero scenes — the
   * operator must create a scene before assets become editable.
   */
  noScenes?: boolean;

  /* ---------- Scenes (per-folder) ---------- */
  scenes: PollScene[];
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  onAddScene: (preset: ScenePreset) => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onDuplicateScene: (sceneId: string) => void;
  onRemoveScene: (sceneId: string) => void;
  /** Toggle whether an asset is visible inside a given scene. Called when
   *  the operator (a) adds an asset that's already on the poll into the
   *  active scene, or (b) hides an asset from a single scene without
   *  removing it from the poll. */
  onSetSceneAssetVisible: (sceneId: string, assetId: AssetId, visible: boolean) => void;

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
  onDuplicateFolder,
  onLinkFolders,
  onUnlinkFolder,
  onToggleAssetInactive,
  blockLetter, onBlockLetterChange,
  noScenes = false,
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onRenameScene,
  onDuplicateScene,
  onRemoveScene,
  onSetSceneAssetVisible,
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
  const [pendingRemoval, setPendingRemoval] = useState<{ folderId: string; assetId: AssetId } | null>(null);
  const [pendingSceneDelete, setPendingSceneDelete] = useState<PollScene | null>(null);

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    const { folderId, assetId } = pendingRemoval;
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      onSelectFolder(folderId);
      onEnabledAssetsChange(folder.assetIds.filter((id) => id !== assetId));
      if (selectedAssetId === assetId) onSelectAsset(null);
    }
    setPendingRemoval(null);
  };

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
            Folders contain scenes. Scenes contain assets.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 relative">
        {folders.map((folder) => {
          const folderAssets = folder.assetIds;
          const isActiveFolder = folder.id === activeFolderId;
          const isCollapsed = Boolean(folder.collapsed);
          // Scene-aware: show every asset in the menu, but mark which ones
          // are already visible in the active scene so the operator can
          // toggle multiple assets in/out of the same scene.
          const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;
          const allAssetIds = Object.keys(ASSET_REGISTRY) as AssetId[];

          // Folder shows the orange "active" treatment ONLY when the folder
          // itself is the current selection (no individual asset selected).
          // Once the operator clicks into an asset card, the folder reverts
          // to neutral so the highlight tracks exactly what is being edited.
          const folderIsTheSelection = isActiveFolder && selectedAssetId === null;
          return (
            <div key={folder.id} className={`rounded-lg border overflow-hidden transition-colors ${folderIsTheSelection ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/40'}`}>
            <div className={`flex items-center gap-2 px-2.5 py-2 border-b border-border/40 bg-background/30 ${
              folderIsTheSelection ? 'ring-1 ring-inset ring-primary/40 bg-primary/10' : ''
            }`}>
              <button
                type="button"
                onClick={() => {
                  // Folder-level select: activate the folder AND clear any
                  // single-asset selection so the Inspector shows folder
                  // properties and every asset card highlights as a group.
                  onSelectFolder(folder.id);
                  onSelectAsset(null);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="Select folder (selects all assets inside)"
              >
                <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActiveFolder ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate flex items-center gap-1">
                    <span className="truncate">{folder.name}</span>
                    {folder.linkedFolderId && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-sm border border-primary/40 bg-primary/10 px-1 text-[8px] font-mono uppercase text-primary"
                        title={`Linked with ${folders.find((f) => f.id === folder.linkedFolderId)?.name ?? 'another folder'} — shares slate, background, and slug.`}
                      >
                        <Link2 className="h-2.5 w-2.5" /> linked
                      </span>
                    )}
                  </p>
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
                    title={
                      isActiveFolder && !activeSceneId
                        ? 'Select a scene first'
                        : `Add asset to ${folder.name}`
                    }
                    disabled={isActiveFolder && !activeSceneId}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64" aria-label={`Add asset options for ${folder.name}`}>
                  <DropdownMenuLabel className="text-[10px] uppercase font-mono">
                    {activeScene ? `Assets in ${activeScene.name}` : 'Add Asset To Scene'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!activeScene && (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground italic">
                      Select a scene first.
                    </div>
                  )}
                  {activeScene && allAssetIds.map((id) => {
                    const meta = ASSET_REGISTRY[id];
                    const Icon = meta.icon;
                    const inScene = activeScene.visibleAssetIds.has(id);
                    return (
                      <DropdownMenuItem
                        key={id}
                        onSelect={(e) => {
                          e.preventDefault();
                          onSelectFolder(folder.id);
                          if (!folderAssets.includes(id)) {
                            // Adds to poll AND auto-marks visible in active scene.
                            onAddAssetToFolder(folder.id, id);
                          } else {
                            // Already on poll — just toggle scene visibility.
                            onSetSceneAssetVisible(activeScene.id, id, !inScene);
                          }
                        }}
                        className="gap-2"
                      >
                        <span className="w-3.5 flex justify-center">
                          {inScene ? <Check className="w-3.5 h-3.5 text-primary" /> : null}
                        </span>
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex flex-col flex-1 min-w-0">
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
                  {onDuplicateFolder && (
                    <DropdownMenuItem
                      aria-label={`Duplicate folder ${folder.name}`}
                      onClick={() => onDuplicateFolder(folder.id)}
                      className="gap-2"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      Duplicate Folder
                    </DropdownMenuItem>
                  )}
                  {onLinkFolders && folders.length > 1 && !folder.linkedFolderId && (
                    <>
                      <DropdownMenuLabel className="text-[10px] uppercase font-mono">Link to folder</DropdownMenuLabel>
                      {folders
                        .filter((other) => other.id !== folder.id && !other.linkedFolderId)
                        .map((other) => (
                          <DropdownMenuItem
                            key={`link-${other.id}`}
                            aria-label={`Link ${folder.name} with ${other.name}`}
                            onClick={() => onLinkFolders(folder.id, other.id)}
                            className="gap-2"
                          >
                            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="truncate">{other.name}</span>
                          </DropdownMenuItem>
                        ))}
                      {folders.filter((other) => other.id !== folder.id && !other.linkedFolderId).length === 0 && (
                        <div className="px-2 py-1.5 text-[10px] text-muted-foreground italic">
                          No other unlinked folders.
                        </div>
                      )}
                    </>
                  )}
                  {onUnlinkFolder && folder.linkedFolderId && (
                    <DropdownMenuItem
                      aria-label={`Unlink folder ${folder.name}`}
                      onClick={() => onUnlinkFolder(folder.id)}
                      className="gap-2"
                    >
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      Unlink Folder
                    </DropdownMenuItem>
                  )}
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
                {isActiveFolder && (
                  <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        <Link2 className="w-3 h-3" />
                        Viewer Slug
                      </label>
                      <span className="text-[9px] font-mono text-muted-foreground/70 truncate max-w-[60%]" title={`makovote.app/vote/${slug || 'your-poll-slug'}`}>
                        /vote/{slug || 'your-poll-slug'}
                      </span>
                    </div>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                      placeholder="asl"
                      className="bg-background/60 h-7 text-[11px] font-mono"
                      aria-label="Viewer slug for QR destination"
                    />
                    <p className="mt-1 text-[9px] text-muted-foreground/70">QR points here. Change per show (ASL, Beyond, DataCast…). When voting is closed viewers see the MakoVote slate.</p>
                  </div>
                )}
                {/* Scenes list (only shown for the active folder; inactive
                    folders just show their slug for context) */}
                {isActiveFolder && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Scenes
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
                        {scenes.length}
                      </span>
                    </div>

                    {scenes.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-5 text-center">
                        <p className="text-xs text-muted-foreground mb-2">
                          Add a scene to begin building this poll.
                        </p>
                        <SceneAddButton onAddScene={onAddScene} variant="default" />
                      </div>
                    ) : (
                      <>
                        {scenes.map((scene) => {
                          const isActiveScene = scene.id === activeSceneId;
                          const preset = getScenePreset(scene.preset);
                          // Assets shown in this scene = poll's enabled assets
                          // intersected with the scene's visibility set.
                          const sceneAssetIds = folderAssets.filter((id) =>
                            scene.visibleAssetIds.has(id),
                          );
                          return (
                            <div
                              key={scene.id}
                              className={`rounded-md border overflow-hidden transition-colors ${
                                isActiveScene
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-border/60 bg-card/30'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 bg-background/30">
                                <button
                                  type="button"
                                  onClick={() => onSelectScene(scene.id)}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  title={preset.description}
                                >
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform ${
                                      isActiveScene ? '' : '-rotate-90'
                                    } ${isActiveScene ? 'text-primary' : 'text-muted-foreground'}`}
                                  />
                                  <span
                                    className={`text-[11px] font-medium truncate ${
                                      isActiveScene ? 'text-primary' : 'text-foreground'
                                    }`}
                                  >
                                    {scene.name}
                                  </span>
                                  <span className="text-[8px] font-mono uppercase text-muted-foreground/70 px-1 py-0.5 rounded bg-muted/40 shrink-0">
                                    {preset.label}
                                  </span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 opacity-60 hover:opacity-100"
                                      aria-label={`Scene actions for ${scene.name}`}
                                    >
                                      <MoreVertical className="w-3 h-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => {
                                        const next = window.prompt('Rename scene', scene.name);
                                        if (next && next.trim()) onRenameScene(scene.id, next.trim());
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => onDuplicateScene(scene.id)}
                                    >
                                      <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-destructive focus:text-destructive"
                                      onClick={() => setPendingSceneDelete(scene)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {isActiveScene && (
                                <div className="p-2 space-y-2">
                                  {sceneAssetIds.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-3 text-center">
                                      <p className="text-[10px] text-muted-foreground">
                                        No assets in this scene yet. Use <span className="font-mono">+</span> in the folder header to add one.
                                      </p>
                                    </div>
                                  ) : (
                                    sceneAssetIds.map((id) => (
                                      <AssetCard
                                        key={id}
                                        meta={ASSET_REGISTRY[id]}
                                        isSelected={selectedAssetId === id}
                                        groupSelected={isActiveFolder && selectedAssetId === null}
                                        inactive={(folder.inactiveAssetIds ?? []).includes(id)}
                                        onToggleInactive={
                                          onToggleAssetInactive
                                            ? () =>
                                                onToggleAssetInactive(
                                                  folder.id,
                                                  id,
                                                  !((folder.inactiveAssetIds ?? []).includes(id)),
                                                )
                                            : undefined
                                        }
                                        onSelect={() => {
                                          onSelectFolder(folder.id);
                                          onSelectAsset(id);
                                        }}
                                        onRemove={() =>
                                          setPendingRemoval({ folderId: folder.id, assetId: id })
                                        }
                                        onHideFromScene={() =>
                                          onSetSceneAssetVisible(scene.id, id, false)
                                        }
                                        onDragStart={() => setDraggedId(id)}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                        }}
                                        onDrop={() => {
                                          onSelectFolder(folder.id);
                                          if (draggedId) reorder(draggedId, id);
                                          setDraggedId(null);
                                        }}
                                      >
                                        <AssetEditor
                                          assetId={id}
                                          question={question}
                                          setQuestion={setQuestion}
                                          subheadline={subheadline}
                                          setSubheadline={setSubheadline}
                                          internalName={internalName}
                                          setInternalName={setInternalName}
                                          slug={slug}
                                          setSlug={setSlug}
                                          answerType={answerType}
                                          setAnswerType={setAnswerType}
                                          mcLabelStyle={mcLabelStyle}
                                          setMcLabelStyle={setMcLabelStyle}
                                          answers={answers}
                                          setAnswers={setAnswers}
                                          onAddAnswer={onAddAnswer}
                                        />
                                      </AssetCard>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <SceneAddButton onAddScene={onAddScene} variant="outline" />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" className="w-full h-8 text-[10px] gap-1" onClick={onCreateFolder}>
          <Plus className="w-3.5 h-3.5" /> New Folder
        </Button>
      </div>
      <AlertDialog
        open={Boolean(pendingSceneDelete)}
        onOpenChange={(open) => { if (!open) setPendingSceneDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scene?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSceneDelete
                ? `Delete "${pendingSceneDelete.name}"? Assets in the poll are not removed — only this scene's visibility settings.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingSceneDelete) onRemoveScene(pendingSceneDelete.id);
                setPendingSceneDelete(null);
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => { if (!open) setPendingRemoval(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove asset?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval
                ? `Remove "${ASSET_REGISTRY[pendingRemoval.assetId]?.label ?? 'this asset'}" from this folder? You can re-add it from the folder menu.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmRemoval}>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Asset Card chrome ---------- */

/* ---------- Scene add button (presets dropdown) ---------- */

function SceneAddButton({
  onAddScene,
  variant = 'outline',
}: {
  onAddScene: (preset: ScenePreset) => void;
  variant?: 'default' | 'outline';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={variant}
          className="w-full h-7 gap-1 text-[10px]"
        >
          <Plus className="w-3 h-3" /> Add Scene
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase font-mono">
          New Scene Preset
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SCENE_PRESETS.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => onAddScene(p.id)} className="gap-2">
            <div className="flex flex-col">
              <span className="text-xs">{p.label}</span>
              <span className="text-[10px] text-muted-foreground line-clamp-1">
                {p.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 opacity-60">
          <div className="flex flex-col">
            <span className="text-xs">L3 (Lower Third)</span>
            <span className="text-[10px] text-muted-foreground">Coming soon</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssetCard({
  meta, isSelected, groupSelected = false, onSelect, onRemove,
  onDragStart, onDragOver, onDrop, children,
  inactive = false,
  onToggleInactive,
  onHideFromScene,
}: {
  meta: AssetMeta;
  isSelected: boolean;
  /** True when the parent folder is selected as a whole — every asset
   *  card in the folder shows a soft group highlight so the operator sees
   *  what "select folder" encompasses. */
  groupSelected?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  children: React.ReactNode;
  inactive?: boolean;
  onToggleInactive?: () => void;
  /** Hide this asset from the current scene without removing it from the
   *  poll. Lets the operator have, e.g., the QR visible in Scene 1 but not
   *  Scene 3 while still keeping a single QR asset on the poll. */
  onHideFromScene?: () => void;
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
      className={`group rounded-lg border transition-all overflow-hidden cursor-pointer ${inactive ? 'opacity-50' : ''} ${
        isSelected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
          : groupSelected
            ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10 hover:border-primary/40'
            : 'border-border/60 bg-card/40 hover:border-border'
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 bg-background/30">
        <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0 cursor-grab" />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-[11px] font-medium flex-1 truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {meta.label}
          {inactive && (
            <span className="ml-1.5 text-[8px] font-mono uppercase tracking-wider text-muted-foreground/70 px-1 py-0.5 rounded bg-muted/40">
              inactive
            </span>
          )}
        </span>
        {onToggleInactive && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleInactive(); }}
            className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors px-1.5 py-0.5"
            title={inactive ? 'Re-activate this asset' : 'Mark this asset inactive'}
          >
            {inactive ? 'Activate' : 'Mute'}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
          className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {!meta.required && onHideFromScene && (
          <button
            onClick={(e) => { e.stopPropagation(); onHideFromScene(); }}
            className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 opacity-0 group-hover:opacity-100"
            title="Hide from this scene (keeps asset on the poll)"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        )}
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
          placeholder="Write question here"
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
          <div key={a.id} className="flex items-center gap-1">
            <Input
              value={a.text}
              onChange={(e) => {
                const next = [...props.answers];
                next[i] = { ...next[i], text: e.target.value };
                props.setAnswers(next);
              }}
              placeholder={`Answer ${i + 1}`}
              className="bg-background/50 h-7 text-[11px] flex-1"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.setAnswers(props.answers.filter((_, idx) => idx !== i));
              }}
              disabled={props.answerType === 'yes-no' || props.answers.length <= 2}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground/60 disabled:cursor-not-allowed"
              title="Remove answer bar"
              aria-label={`Remove answer ${i + 1}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
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

  if (assetId === 'answerType') {
    return (
      <div className="space-y-1.5">
        {props.answers.map((a, i) => (
          <div key={a.id} className="flex items-center gap-1">
            <Input
              value={a.text}
              onChange={(e) => {
                const next = [...props.answers];
                next[i] = { ...next[i], text: e.target.value };
                props.setAnswers(next);
              }}
              placeholder={`Choice ${i + 1}`}
              className="bg-background/50 h-7 text-[11px] flex-1"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (props.answers.length > 1) {
                  props.setAnswers(props.answers.filter((_, idx) => idx !== i));
                }
              }}
              disabled={props.answers.length <= 1}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground/60 disabled:cursor-not-allowed"
              title="Remove choice"
              aria-label={`Remove choice ${i + 1}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1 text-[10px]"
          onClick={props.onAddAnswer}
        >
          <Plus className="w-3 h-3" /> Add Choice
        </Button>
        <p className="text-[9px] text-muted-foreground">
          Voter-facing choices on mobile/desktop. Inspector controls Yes/No vs MC and label style.
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
