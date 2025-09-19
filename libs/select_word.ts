export const select_word_storage = storage.defineItem<string | null>("local:select_word"); 


export type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};
