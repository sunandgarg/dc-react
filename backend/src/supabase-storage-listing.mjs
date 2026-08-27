function normalizedPrefix(prefix) {
  return String(prefix || "").replace(/^\/+|\/+$/g, "");
}

export async function listSupabaseStorageObjects({
  bucket,
  listPage,
  pageSize = 1000,
  prefix = "",
}) {
  if (!bucket || typeof listPage !== "function") {
    throw new TypeError("bucket and listPage are required");
  }

  const folders = [normalizedPrefix(prefix)];
  const queued = new Set(folders);
  const objects = [];

  for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
    const folder = folders[folderIndex];
    for (let offset = 0; ; offset += pageSize) {
      const page = await listPage({ bucket, prefix: folder, limit: pageSize, offset });
      if (!Array.isArray(page)) throw new TypeError(`Supabase returned a non-array listing for ${bucket}/${folder}`);

      for (const entry of page) {
        if (!entry?.name) continue;
        const objectPath = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id || entry.metadata) {
          objects.push({ ...entry, objectPath });
        } else if (objectPath !== folder && !queued.has(objectPath)) {
          queued.add(objectPath);
          folders.push(objectPath);
        }
      }

      if (page.length < pageSize) break;
    }
  }

  return objects;
}
