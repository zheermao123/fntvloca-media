/** 详情页渲染层 DTO 与模型（仅映射真实业务字段） */
export type EpisodeRowModel = {
    id: string;
    label: string;
    title: string;
    stateText: string;
};

export type MetaItem = { label: string; value: string };

export type MediaDetailModel = {
    kind: 'movie' | 'season';
    title: string;
    poster: string | null;
    overview: string | null;
    meta: MetaItem[];
    file: { name: string; sizeLabel: string; resolution: string | null } | null;
    episodes: EpisodeRowModel[];
    playTargetId: string | null;
    playLabel: string;
};
