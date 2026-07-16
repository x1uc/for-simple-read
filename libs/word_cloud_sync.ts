import {
  deleteRemoteWord,
  getCloudAccount,
  listRemoteWords,
  markRemoteWordSynced,
  upsertRemoteWord,
  type CloudAccount,
  type RemoteWord,
} from "./cloud_api";
import {
  cloud_account_storage,
  cloud_api_key_storage,
  cloud_device_name_storage,
  collection_words_storage,
} from "./local_storage";
import type { WordData } from "./select_word";

export type CloudConfig = { apiKey: string; deviceName: string };
export type CloudSyncResult = {
  username: string;
  uploaded: number;
  downloaded: number;
  removed: number;
  failed: number;
};

function normalizeWord(word: string): string {
  return word.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

function fromRemote(remote: RemoteWord, local?: WordData): WordData {
  const localSynced = Boolean(local?.syncedToYoudao);
  return {
    word: remote.originalWord,
    pronunciation: local?.pronunciation || "",
    meaning: remote.meaning,
    syncedToYoudao: localSynced || remote.syncedToYoudao,
    remoteId: remote.id,
    sourceDevice: remote.deviceName,
    remoteUpdatedAt: remote.updatedAt,
    cloudSyncPending: false,
    pendingYoudaoSync: localSynced && !remote.syncedToYoudao,
  };
}

async function replaceStoredWord(word: WordData): Promise<void> {
  const words = (await collection_words_storage.getValue()) || [];
  const key = normalizeWord(word.word);
  const index = words.findIndex((item) => normalizeWord(item.word) === key);
  const next = [...words];
  if (index >= 0) next[index] = word;
  else next.push(word);
  await collection_words_storage.setValue(next);
}

async function removeStoredWord(word: WordData): Promise<void> {
  const key = normalizeWord(word.word);
  const words = (await collection_words_storage.getValue()) || [];
  await collection_words_storage.setValue(
    words.filter((item) => normalizeWord(item.word) !== key),
  );
}

export async function getCloudConfig(): Promise<CloudConfig | null> {
  const [apiKey, deviceName] = await Promise.all([
    cloud_api_key_storage.getValue(),
    cloud_device_name_storage.getValue(),
  ]);
  if (!apiKey?.trim()) return null;
  return { apiKey: apiKey.trim(), deviceName: deviceName.trim() || "default" };
}

async function uploadWord(word: WordData, config: CloudConfig): Promise<WordData> {
  const remote = await upsertRemoteWord(config.apiKey, {
    deviceName: config.deviceName,
    originalWord: word.word,
    meaning: word.meaning,
    syncedToYoudao: Boolean(word.syncedToYoudao),
  });
  const saved = fromRemote(remote, word);
  await replaceStoredWord(saved);
  return saved;
}

export async function collectWord(word: WordData): Promise<void> {
  const [config, deviceName] = await Promise.all([
    getCloudConfig(),
    cloud_device_name_storage.getValue(),
  ]);
  const words = (await collection_words_storage.getValue()) || [];
  const key = normalizeWord(word.word);
  const existing = words.find((item) => normalizeWord(item.word) === key);
  const local: WordData = {
    ...existing,
    ...word,
    sourceDevice: deviceName.trim() || "default",
    cloudSyncPending: true,
  };
  await replaceStoredWord(local);
  if (config) await uploadWord(local, config);
}

export async function syncCloudWords(
  override?: CloudConfig,
): Promise<CloudSyncResult> {
  const config = override || (await getCloudConfig());
  if (!config) throw new Error("请先配置云端同步密钥");

  const remoteResult = await listRemoteWords(config.apiKey);
  const remoteByWord = new Map(
    remoteResult.words.map((word) => [normalizeWord(word.originalWord), word]),
  );
  const localWords = (await collection_words_storage.getValue()) || [];
  const localByWord = new Map<string, WordData>();
  for (const word of localWords) localByWord.set(normalizeWord(word.word), word);

  const next: WordData[] = [];
  let uploaded = 0;
  let downloaded = 0;
  let removed = 0;
  let failed = 0;

  for (const [key, local] of localByWord) {
    const remote = remoteByWord.get(key);
    if (remote) {
      let merged = fromRemote(remote, local);
      if (merged.pendingYoudaoSync) {
        try {
          merged = fromRemote(
            await markRemoteWordSynced(config.apiKey, remote.id),
            merged,
          );
        } catch {
          failed++;
        }
      }
      next.push(merged);
      remoteByWord.delete(key);
      continue;
    }

    if (local.remoteId) {
      removed++;
      continue;
    }

    try {
      const saved = await upsertRemoteWord(config.apiKey, {
        deviceName: config.deviceName,
        originalWord: local.word,
        meaning: local.meaning,
        syncedToYoudao: Boolean(local.syncedToYoudao),
      });
      next.push(fromRemote(saved, local));
      uploaded++;
    } catch {
      next.push({ ...local, cloudSyncPending: true });
      failed++;
    }
  }

  for (const remote of remoteByWord.values()) {
    next.push(fromRemote(remote));
    downloaded++;
  }

  await collection_words_storage.setValue(next);
  return {
    username: remoteResult.username,
    uploaded,
    downloaded,
    removed,
    failed,
  };
}

export async function configureCloudSync(
  apiKey: string,
  deviceName: string,
): Promise<{ account: CloudAccount; result: CloudSyncResult }> {
  const nextConfig = {
    apiKey: apiKey.trim(),
    deviceName: deviceName.trim() || "default",
  };
  if (!nextConfig.apiKey) throw new Error("同步密钥不能为空");

  const account = await getCloudAccount(nextConfig.apiKey);
  const previous = await getCloudConfig();
  if (previous && previous.apiKey !== nextConfig.apiKey) {
    const previousResult = await syncCloudWords(previous);
    if (previousResult.failed) {
      throw new Error("旧账户仍有本地单词未上传，已取消切换密钥");
    }
    await collection_words_storage.setValue([]);
  }

  await Promise.all([
    cloud_api_key_storage.setValue(nextConfig.apiKey),
    cloud_device_name_storage.setValue(nextConfig.deviceName),
    cloud_account_storage.setValue(account),
  ]);
  const result = await syncCloudWords(nextConfig);
  return { account, result };
}

export async function deleteCollectedWord(word: WordData): Promise<void> {
  if (word.remoteId) {
    const config = await getCloudConfig();
    if (!config) throw new Error("缺少云端密钥，无法安全删除远程单词");
    await deleteRemoteWord(config.apiKey, word.remoteId);
  }
  await removeStoredWord(word);
}

export async function pushYoudaoStatuses(words: WordData[]): Promise<void> {
  const config = await getCloudConfig();
  if (!config) return;

  for (const word of words.filter((item) => item.syncedToYoudao)) {
    try {
      if (word.remoteId) {
        await replaceStoredWord(
          fromRemote(await markRemoteWordSynced(config.apiKey, word.remoteId), word),
        );
      } else {
        await uploadWord({ ...word, pendingYoudaoSync: true }, config);
      }
    } catch {
      await replaceStoredWord({ ...word, pendingYoudaoSync: true });
    }
  }
}
