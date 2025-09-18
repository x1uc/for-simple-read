import { eudic_token_storage, eudic_switch_storage } from "@/libs/local_storage"
type colect_res = {
    code: number;
    message: string;
}

abstract class word_collector {
    async colect_word(word: string, context_line?: string): Promise<colect_res> {
        throw new Error("Method not implemented.");
    }
}


class eudic_word_collector extends word_collector {
    async colect_word(word: string, context_line: string): Promise<colect_res> {
        try {
            if (!eudic_token_storage.getValue()) {
                return { code: 401, message: "Eudic token is not set" };
            }
            const eduic_url = new URL("https://api.frdic.com/api/open/v1/studylist/word")
            const body = {
                language: "en",
                word: word,
                context_line: context_line || "",
                category_ids: [0],
            }
            const headers = {
                'User-Agent': 'Mozilla/5.0',
                'Authorization': `${eudic_token_storage.getValue()}`,
                'Content-Type': 'application/json'
            }
            const res = await fetch(eduic_url.toString(), {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            if (res.status === 201) {
                return { code: 0, message: "Word collected successfully" };
            } else {
                return { code: res.status, message: `Failed to collect word: ${res.statusText}` };
            }
        } catch (error) {
            return { code: 500, message: `Error: ${error}` };
        }
    }
}

