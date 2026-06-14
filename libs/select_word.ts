export const select_word_storage = storage.defineItem<SelectInfo | null>("local:select_word"); 


export type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
    syncedToYoudao?: boolean;
};

export type SelectInfo = {
    context: string;
    word: string;
}
